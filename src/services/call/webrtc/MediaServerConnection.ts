import { MediaType } from '../types';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { CallConnection } from '../socket/callConnection';
import { useAuthStore } from '@/stores/authStore.ts';
import { OP_CODES } from '@/services/call/constants.ts';

export class MediaServerConnection {
  private audioDetectionInterval: number | null = null;
  private static instance: MediaServerConnection | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callConnection: CallConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private connectionState = {
    isRemoteDescriptionSet: false,
    isConnecting: false,
  };
  private audioContextMap: Map<string, {
    context: AudioContext;
    analyser: AnalyserNode;
    dataArray: Uint8Array;
  }> = new Map();

  private constructor() {
  }

  static getInstance(): MediaServerConnection {
    if (!this.instance) {
      this.instance = new MediaServerConnection();
    }
    return this.instance;
  }

  setCallConnection(connection: CallConnection) {
    this.callConnection = connection;
  }

  async prepareConnection(channelId: string) {
    // 기존 연결 완전히 정리
    await this.cleanupExistingConnection();

    this.connectionState.isConnecting = true;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.setupPeerConnectionHandlers(channelId);

    // 로컬 스트림 추가 전에 트랙 순서 보장
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();

      // 오디오 트랙 먼저 추가
      audioTracks.forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 비디오 트랙 나중에 추가
      videoTracks.forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }
  }

  private async cleanupExistingConnection() {
    if (this.peerConnection) {
      // 모든 트랙 제거
      const senders = this.peerConnection.getSenders();
      for (const sender of senders) {
        this.peerConnection.removeTrack(sender);
      }

      // 연결 종료
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.reset();

    // 약간의 딜레이를 주어 리소스가 완전히 정리되도록 함
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async connect() {
    if (!this.peerConnection || !this.connectionState.isConnecting) {
      throw new Error('Connection not prepared');
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      this.reset();
      throw error;
    }
  }

  private reset() {
    this.connectionState = {
      isRemoteDescriptionSet: false,
      isConnecting: false,
    };
    this.pendingCandidates = [];
  }

  private setupPeerConnectionHandlers(channelId: string) {
    if (!this.peerConnection) return;

    // 기존 트랙 이벤트 핸들러
    this.peerConnection.ontrack = (event) => {
      const { streams, track } = event;
      if (streams.length === 0) return;

      const stream = streams[0];
      const metadata = track.id.split('_');
      const userId = metadata[0];
      const isScreenShare = metadata[1] === 'screen';

      // 스트림 업데이트
      useUserChannelStore.getState().updateUserMediaState(
        channelId,
        userId,
        isScreenShare ? { screenStream: stream } : { stream },
      );

      // 오디오 트랙인 경우에만 음성 감지 설정
      if (track.kind === 'audio' && !isScreenShare) {
        this.setupRemoteAudioDetection(stream, userId);
      }
    };

    // ICE candidate 처리
    let iceCandidatesCount = 0;
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        iceCandidatesCount++;

        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.toJSON(),
          sdp_mid: event.candidate.sdpMid,
          sdp_m_line_index: event.candidate.sdpMLineIndex,
        });
      } else {
        // null candidate는 ICE gathering 완료를 의미
        // console.log(`ICE gathering completed. Total candidates: ${iceCandidatesCount}`);
      }
    };

    // WebRTC 연결 상태 모니터링
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`WebRTC Connection State → ${state}`);

      switch (state) {
        case 'connected':
          console.log('✓ WebRTC connection established');
          this.connectionState.isConnecting = false;
          break;
        case 'disconnected':
          console.warn('WebRTC connection disconnected - attempting to recover');
          // 필요한 경우 재연결 로직 추가
          break;
        case 'failed':
          console.error('WebRTC connection failed');
          this.reset();
          // 연결 실패 처리 (예: UI 업데이트, 재연결 시도 등)
          break;
        case 'closed':
          console.log('WebRTC connection closed');
          this.reset();
          break;
      }
    };

    // ICE 연결 상태 모니터링
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log(`ICE Connection State → ${state}`);

      if (state === 'failed') {
        console.warn('ICE connection failed - attempting to restart ICE');
        this.peerConnection?.restartIce();
      }
    };

    // 협상 필요 이벤트 처리
    this.peerConnection!.onnegotiationneeded = async () => {
      // 이미 연결 시도 중이면 무시
      if (!this.connectionState.isConnecting) {
        try {
          this.connectionState.isConnecting = true;
          await this.connect();
        } catch (error) {
          console.error('Error during renegotiation:', error);
          this.connectionState.isConnecting = false;
        }
      }
    };

    // ICE gathering 상태 모니터링
    this.peerConnection.onicegatheringstatechange = () => {
      console.log(`ICE Gathering State → ${this.peerConnection?.iceGatheringState}`);
    };
  }

  private setupLocalAudioDetection(stream: MediaStream) {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.email) return;

    this.setupAudioDetection(stream, currentUser.email);
  }

  private setupRemoteAudioDetection(stream: MediaStream, userId: string) {
    this.setupAudioDetection(stream, userId);
  }

  async handleRemoteAnswer(sdp: string) {
    if (!this.peerConnection || !this.connectionState.isConnecting) {
      console.warn('Ignoring remote answer - connection not ready');
      return;
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp,
      }));

      this.connectionState.isRemoteDescriptionSet = true;

      // Process pending candidates
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift()!;
        await this.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error setting remote description:', error);
      this.reset();
      throw error;
    }
  }

  private async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection || !this.connectionState.isConnecting) return;

    try {
      if (this.connectionState.isRemoteDescriptionSet) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.pendingCandidates.push(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private setupAudioDetection(stream: MediaStream, userId: string) {
    try {
      // 기존 설정이 있다면 정리
      this.cleanupAudioDetection(userId);

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      // FFT 크기를 더 작게 설정하여 반응성 향상
      analyser.fftSize = 128;
      // smoothingTimeConstant를 낮춰서 더 빠른 반응
      analyser.smoothingTimeConstant = 0.2;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioContextMap.set(userId, { context: audioContext, analyser, dataArray });

      if (!this.audioDetectionInterval) {
        this.audioDetectionInterval = window.setInterval(() => {
          this.audioContextMap.forEach((audio, uid) => {
            const { analyser, dataArray } = audio;
            analyser.getByteFrequencyData(dataArray);

            // 더 낮은 임계값 설정 (원래 20)
            const threshold = 10;
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const isSpeaking = average > threshold;

            const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;
            if (!currentChannelId) return;

            const currentState = useUserChannelStore.getState()
              .channelUsers.get(currentChannelId)
              ?.find(user => user.userId === uid)?.mediaState.isSpeaking;

            if (currentState !== isSpeaking) {
              useUserChannelStore.getState().updateUserMediaState(
                currentChannelId,
                uid,
                { isSpeaking }
              );
            }
          });
        }, 50); // 간격을 100ms에서 50ms로 줄임
      }
    } catch (error) {
      console.error('Failed to setup audio detection:', error);
    }
  }


  private cleanupAudioDetection(userId?: string) {
    if (userId) {
      // 특정 사용자의 오디오 컨텍스트만 정리
      const audioContext = this.audioContextMap.get(userId);
      if (audioContext) {
        audioContext.context.close();
        this.audioContextMap.delete(userId);
      }
    } else {
      // 모든 오디오 컨텍스트 정리
      this.audioContextMap.forEach(audio => audio.context.close());
      this.audioContextMap.clear();
    }

    // 모든 오디오 컨텍스트가 제거되었다면 인터벌도 정리
    if (this.audioContextMap.size === 0 && this.audioDetectionInterval) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
  }

  async updateLocalStream(type: MediaType): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'VIDEO' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      });

      this.setupLocalAudioDetection(stream);
      this.replaceStream(stream);
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      return null;
    }
  }

  private replaceStream(newStream: MediaStream) {
    // 기존 트랙 제거
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // 피어 커넥션의 기존 sender 제거 및 새로운 트랙 추가
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => {
        this.peerConnection?.removeTrack(sender);
      });

      newStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, newStream);
      });
    }
  }

  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // 스크린 공유 트랙을 SFU 서버로 전송
      if (this.peerConnection) {
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.contentHint = `${useAuthStore.getState().user?.email}_screen`;
        this.peerConnection.addTrack(videoTrack, stream);
      }

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  async stopScreenShare() {
    if (!this.peerConnection) return;

    // 스크린 공유 트랙 제거
    this.peerConnection.getSenders().forEach(sender => {
      if (sender.track?.id.includes('_screen')) {
        this.peerConnection?.removeTrack(sender);
      }
    });
  }

  disconnect() {
    this.cleanupAudioDetection();
    this.reset();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  dispose() {
    this.disconnect();
    MediaServerConnection.instance = null;
  }
}