import { CallConnection } from '../callConnection';
import { WebRTCConfig, WebRTCConnectionOptions } from './types';
import { useVoiceChat } from '@/hooks/useVoiceChat.ts';
import { useVideoChat } from '@/hooks/useVideoChat.ts';

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
  private audioContext: AudioContext | null = null;

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

  private async sendPresenterOfferSafely(sdp: string) {
    const currentState = {
      users: this.callConnection?.state.users || [],
      currentUser: this.callConnection?.state.currentUser,
    };

    await this.callConnection?.sendPresenterOffer(sdp);

    // 상태가 초기화되었는지 확인하고 복원
    if (this.callConnection) {
      const newState = this.callConnection.state;
      if (!newState.currentUser && currentState.currentUser) {
        this.callConnection['updateCurrentUser'](currentState.currentUser);
      }
      if (newState.users.length === 0 && currentState.users.length > 0) {
        this.callConnection['updateUsers'](() => currentState.users);
      }
    }
  }

  private async initializePeerConnection(options?: WebRTCConnectionOptions) {
    this.validateState();

    try {
      const config = options?.configuration || DEFAULT_CONFIG;
      this.peerConnection = new RTCPeerConnection(config);

      if (!this.peerConnection) {
        throw new Error('Failed to create RTCPeerConnection');
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.callConnection) {
          // console.log('Sending ICE candidate');
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

      if (!this.peerConnection) {
        throw new Error('PeerConnection initialization failed');
      }

      // 채널 타입에 따른 미디어 스트림 요청
      const isVideoChannel = !!videoElement;
      const constraints = {
        audio: true,
        video: isVideoChannel ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
      };

      // console.log(`Requesting media stream for ${isVideoChannel ? 'video' : 'voice'} channel`);
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
        offerToReceiveVideo: isVideoChannel,
      });

      await this.peerConnection!.setLocalDescription(offer);
      this.sendPresenterOfferSafely(offer.sdp!);

    } catch (error) {
      console.error('Failed to initialize presenter:', error);
      this.events?.onError?.(error as Error);
      // dispose 호출 시 CallConnection의 상태를 보존
      const currentState = {
        users: this.callConnection?.state.users || [],
        currentUser: this.callConnection?.state.currentUser,
      };
      this.dispose();
      // 상태 복원
      if (this.callConnection) {
        this.callConnection['updateUsers'](() => currentState.users);
        if (currentState.currentUser) {
          this.callConnection['updateCurrentUser'](currentState.currentUser);
        }
      }
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

  async replaceAudioTrack(track: MediaStreamTrack | null) {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders()
      .find(s => s.track?.kind === 'audio');

    if (sender) {
      await sender.replaceTrack(track);
    } else if (track) {
      this.peerConnection.addTrack(track, new MediaStream([track]));
    }

    // Update audio stream reference
    if (track) {
      this.audioStream = new MediaStream([track]);
    } else if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
  }

  private setupVoiceDetection() {
    console.log('Setting up voice detection...'); // 디버깅용 로그 추가

    // 이미 존재하는 analyser context 정리
    if (this.audioContext) {
      this.audioContext.close();
    }

    // 오디오 스트림 확인
    const audioStream = this.audioStream || this.localStream;
    if (!audioStream) {
      console.warn('No audio stream available for voice detection');
      return;
    }

    const audioTracks = audioStream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn('No audio tracks found in the stream');
      return;
    }

    // 새로운 AudioContext 생성
    this.audioContext = new AudioContext();
    const audioSource = this.audioContext.createMediaStreamSource(audioStream);
    const analyser = this.audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    audioSource.connect(analyser);
    let animationFrameId: number;

    const checkAudioLevel = () => {
      const voiceChatState = useVoiceChat.getState();
      const videoChatState = useVideoChat.getState();

      if (this.callConnection?.state.currentUser) {
        const userId = this.callConnection.state.currentUser.user_id;

        // 현재 트랙 상태 확인
        const isAudioEnabled = audioTracks.some(track => track.enabled);
        const isMuted = voiceChatState.isMuted || videoChatState.isMuted;

        if (!isAudioEnabled || isMuted) {
          voiceChatState.updateUserSpeaking(userId, false);
          videoChatState.updateUserSpeaking(userId, false);
        } else {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const isSpeaking = average > 30;

          voiceChatState.updateUserSpeaking(userId, isSpeaking);
          videoChatState.updateUserSpeaking(userId, isSpeaking);
        }

        animationFrameId = requestAnimationFrame(checkAudioLevel);
      }
    };

    checkAudioLevel();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }

  async replaceVideoTrack(track: MediaStreamTrack | null) {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders()
      .find(s => s.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(track);
      if (track && this.videoStream) {
        const oldTracks = this.videoStream.getTracks();
        oldTracks.forEach(t => t.stop());
        this.videoStream.addTrack(track);
      } else if (track) {
        this.videoStream = new MediaStream([track]);
      }
    } else if (track) {
      this.peerConnection.addTrack(track, new MediaStream([track]));
      this.videoStream = new MediaStream([track]);
    }
  }

  async removeVideoTrack() {
    if (!this.peerConnection) return;

    const videoSender = this.peerConnection.getSenders()
      .find(s => s.track?.kind === 'video');

    if (videoSender) {
      await videoSender.replaceTrack(null);
      if (videoSender.track) {
        videoSender.track.stop();
      }
    }

    // 비디오 스트림만 정리
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }

    // 오디오 스트림은 유지
    // 음성 감지 재설정
    if (this.audioStream) {
      this.setupVoiceDetection();
    }
  }

  async toggleAudio(enabled: boolean) {
    console.log('Toggling audio:', enabled); // 디버깅용 로그 추가

    const voiceChatState = useVoiceChat.getState();
    const videoChatState = useVideoChat.getState();
    const userId = this.callConnection?.state.currentUser?.user_id;

    if (!userId) {
      console.warn('No current user found');
      return;
    }

    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      console.log('Audio tracks:', audioTracks.length); // 디버깅용 로그 추가

      // 모든 오디오 트랙의 상태 변경
      audioTracks.forEach(track => {
        track.enabled = enabled;
        console.log('Track enabled:', track.enabled); // 디버깅용 로그 추가
      });

      if (enabled) {
        console.log('Unmuting - Setting up voice detection'); // 디버깅용 로그 추가
        // AudioContext 재생성 및 음성 감지 재설정
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
        this.setupVoiceDetection();
      } else {
        console.log('Muting - Cleaning up voice detection'); // 디버깅용 로그 추가
        // speaking 상태 false로 설정
        voiceChatState.updateUserSpeaking(userId, false);
        videoChatState.updateUserSpeaking(userId, false);

        // AudioContext 정리
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
      }
    } else {
      console.warn('No local stream available'); // 디버깅용 로그 추가
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
        // console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
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