import { CallConnection } from '../callConnection';
import { WebRTCConfig, WebRTCConnectionOptions } from './types';
import { useVoiceChat } from '@/hooks/useVoiceChat.ts';

interface WebRTCEvents {
  onTrack?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export class WebRTCConnection {
  private static instance: WebRTCConnection | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callConnection: CallConnection | null = null;
  private events: WebRTCEvents | null = null;
  private isPresenter: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private pendingCandidates: RTCIceCandidate[] = [];
  private audioStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;

  private constructor() {
  }

  static getInstance(): WebRTCConnection {
    if (!WebRTCConnection.instance) {
      WebRTCConnection.instance = new WebRTCConnection();
    }
    return WebRTCConnection.instance;
  }

  initialize(callConnection: CallConnection, events: WebRTCEvents) {
    this.callConnection = callConnection;
    this.events = events;
    this.reconnectAttempts = 0;
  }

  private validateState() {
    if (!this.callConnection || !this.events) {
      throw new Error('WebRTCConnection not properly initialized. Call initialize() first.');
    }
  }

  private async initializePeerConnection(options?: WebRTCConnectionOptions) {
    this.validateState();

    try {
      const config = options?.configuration || DEFAULT_CONFIG;
      this.peerConnection = new RTCPeerConnection(config);

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.callConnection) {
          console.log('Sending ICE candidate');
          this.callConnection.sendIceCandidate(event.candidate);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state changed:', this.peerConnection?.connectionState);
        this.events?.onConnectionStateChange?.(this.peerConnection!.connectionState);

        if (this.peerConnection?.connectionState === 'failed') {
          this.handleConnectionFailure();
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
      };
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
      throw error;
    }
  }

  private async handleConnectionFailure() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

      // Cleanup existing connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Retry connection
      try {
        await this.initializePeerConnection();
        if (this.isPresenter) {
          await this.initializePresenter(null);
        } else {
          await this.initializeViewer(null);
        }
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        this.events?.onError?.(error as Error);
      }
    } else {
      console.error('Max reconnection attempts reached');
      this.events?.onError?.(new Error('Failed to establish connection after multiple attempts'));
    }
  }

  async initializePresenter(videoElement: HTMLVideoElement | null, options?: WebRTCConnectionOptions) {
    try {
      this.validateState();
      this.isPresenter = true;
      await this.initializePeerConnection(options);

      // 채널 타입에 따른 미디어 스트림 요청
      const isVideoChannel = !!videoElement;
      const constraints = {
        audio: true,
        video: isVideoChannel ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      };

      console.log(`Requesting media stream for ${isVideoChannel ? 'video' : 'voice'} channel`);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 음성 감지 설정
      this.setupVoiceDetection();

      // 비디오 채널인 경우에만 로컬 비디오 표시
      if (videoElement && isVideoChannel) {
        videoElement.srcObject = this.localStream;
      }

      // 트랙 추가
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });

      // Offer 생성 및 전송
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoChannel
      });

      await this.peerConnection!.setLocalDescription(offer);
      this.callConnection!.sendPresenterOffer(offer.sdp!);

    } catch (error) {
      console.error('Failed to initialize presenter:', error);
      this.events?.onError?.(error as Error);
      this.dispose();
    }
  }

  dispose() {
    console.log('Disposing WebRTC connection');

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }


    // 모든 미디어 트랙 정리
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
      this.localStream = null;
    }

    // PeerConnection 정리
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.callConnection = null;
    this.events = null;
    this.isPresenter = false;
    this.reconnectAttempts = 0;
    this.pendingCandidates = [];

    console.log('WebRTC connection disposed');
  }

  async initializeViewer(videoElement: HTMLVideoElement | null, options?: WebRTCConnectionOptions) {
    try {
      this.validateState();
      this.isPresenter = false;
      await this.initializePeerConnection(options);

      if (videoElement && this.peerConnection) {
        this.peerConnection.ontrack = (event) => {
          console.log('Received remote track:', event.track);
          // 초기 deafened 상태 체크
          const isDeafened = useVoiceChat.getState().isDeafened;
          event.track.enabled = !isDeafened;  // deafened 상태면 트랙 비활성화

          videoElement.srcObject = event.streams[0];
          this.events?.onTrack?.(event.streams[0]);
        };
      }

      console.log('Creating viewer offer');
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      console.log('Setting local description');
      await this.peerConnection!.setLocalDescription(offer);

      console.log('Sending viewer offer to server');
      this.callConnection!.sendViewerOffer(offer.sdp!);

    } catch (error) {
      console.error('Failed to initialize viewer:', error);
      this.events?.onError?.(error as Error);
      this.dispose();
    }
  }

  async toggleDeafened(deafened: boolean) {
    if (this.peerConnection) {
      this.peerConnection.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.enabled = !deafened;
        }
      });
    }
  }

  async replaceVideoTrack(track: MediaStreamTrack) {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders()
      .find(s => s.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(track);
    } else {
      this.peerConnection.addTrack(track, this.videoStream || new MediaStream([track]));
    }

    // 비디오 스트림 업데이트
    if (this.videoStream) {
      const oldTracks = this.videoStream.getTracks();
      oldTracks.forEach(t => t.stop());
    }
    this.videoStream = new MediaStream([track]);
  }

  async processSdpAnswer(sdpAnswer: string) {
    if (!this.peerConnection) {
      throw new Error('No peer connection established');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdpAnswer,
      }));

      // 저장해둔 ICE candidate들을 이제 처리
      if (this.pendingCandidates.length > 0) {
        for (const candidate of this.pendingCandidates) {
          await this.peerConnection.addIceCandidate(candidate);
        }
        this.pendingCandidates = [];
      }
    } catch (error) {
      console.error('Failed to process SDP answer:', error);
      throw error;
    }
  }

// ICE candidate를 받았을 때 처리하는 부분
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (this.peerConnection?.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // remote description이 아직 없으면 candidate를 저장
        this.pendingCandidates.push(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      throw error;
    }
  }

  private setupVoiceDetection() {
    if (!this.localStream) return;

    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(this.localStream);
    const analyser = audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    audioSource.connect(analyser);
    let animationFrameId: number;

    const checkAudioLevel = () => {
      const state = useVoiceChat.getState();

      if (this.callConnection?.state.currentUser) {
        const userId = this.callConnection.state.currentUser.user_id;

        if (state.isMuted) {
          state.updateUserSpeaking(userId, false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const isSpeaking = average > 30;
        state.updateUserSpeaking(userId, isSpeaking);

        // mute 상태가 아닐 때만 다음 프레임 요청
        animationFrameId = requestAnimationFrame(checkAudioLevel);
      }
    };

    // 초기 시작
    checkAudioLevel();

    // cleanup 용도로 반환
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      audioContext.close();
    };
  }

  async removeVideoTrack() {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders()
      .find(s => s.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(null);
    }

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
  }

  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
        console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}