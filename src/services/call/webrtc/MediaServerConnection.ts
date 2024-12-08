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

    // 기존 오디오 감지 정리 (있다면)
    this.cleanupAudioDetection(currentUser.email);

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      // 오디오 처리 파이프라인 설정
      source.connect(analyser);
      source.connect(audioContext.destination);

      // FFT 설정
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioContextMap.set(currentUser.email, { context: audioContext, analyser, dataArray });

      // 음성 감지 인터벌 설정
      if (!this.audioDetectionInterval) {
        this.audioDetectionInterval = window.setInterval(() => {
          this.audioContextMap.forEach((audio, uid) => {
            const { analyser, dataArray } = audio;
            analyser.getByteFrequencyData(dataArray);

            // 음성 감지 로직
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const average = sum / dataArray.length;
            const isSpeaking = average > 15; // 임계값 15로 설정

            const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;
            if (!currentChannelId) return;

            const currentState = useUserChannelStore.getState()
              .channelUsers.get(currentChannelId)
              ?.find(user => user.userId === uid)?.mediaState.isSpeaking;

            // 상태가 변경됐을 때만 업데이트
            if (currentState !== isSpeaking) {
              useUserChannelStore.getState().updateUserMediaState(
                currentChannelId,
                uid,
                { isSpeaking },
              );
            }
          });
        }, 50); // 50ms 간격으로 체크
      }
    } catch (error) {
      console.error('Failed to setup audio detection:', error);
    }
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

      // 오디오 처리 파이프라인 설정
      source.connect(analyser);
      // destination에 연결하여 오디오가 실제로 흐르도록 함
      source.connect(audioContext.destination);

      // FFT 크기와 평활화 상수 설정
      analyser.fftSize = 256; // 더 세밀한 주파수 분석을 위해 증가
      analyser.smoothingTimeConstant = 0.3; // 약간 더 부드러운 전환을 위해 조정

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioContextMap.set(userId, { context: audioContext, analyser, dataArray });

      if (!this.audioDetectionInterval) {
        this.audioDetectionInterval = window.setInterval(() => {
          this.audioContextMap.forEach((audio, uid) => {
            const { analyser, dataArray } = audio;
            analyser.getByteFrequencyData(dataArray);

            // 음성 감지를 위한 주파수 분석
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const average = sum / dataArray.length;
            const threshold = 15; // 임계값 조정
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
                { isSpeaking },
              );
            }
          });
        }, 50);
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
      // 현재 사용자와 채널 ID 가져오기
      const currentUser = useAuthStore.getState().user;
      const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;

      if (!currentUser?.email || !currentChannelId) return null;

      // 현재 사용자의 미디어 상태 확인
      const channelUsers = useUserChannelStore.getState().channelUsers.get(currentChannelId) || [];
      const userState = channelUsers.find(user => user.userId === currentUser.email);
      const isCameraOn = userState?.mediaState.isCameraOn ?? false;

      // 미디어 제약 조건 설정
      const constraints: MediaStreamConstraints = {
        audio: true, // 오디오는 항상 필요
        video: type === 'VIDEO' && isCameraOn ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 오디오 감지 설정 및 스트림 교체
      this.setupLocalAudioDetection(stream);
      this.replaceStream(stream);
      this.localStream = stream;

      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      return null;
    }
  }

  replaceStream(newStream: MediaStream) {
    // 기존 트랙 중지 및 제거
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();  // 모든 트랙 확실히 중지
      });
    }

    // 새로운 스트림 설정
    this.localStream = newStream;

    // 새 스트림에 대한 오디오 감지 설정
    const audioTracks = newStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.setupLocalAudioDetection(newStream);
    }

    // 피어 커넥션의 기존 sender 제거 및 새로운 트랙 추가
    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      senders.forEach(sender => {
        this.peerConnection?.removeTrack(sender);
      });

      // 새 트랙 추가 (오디오 트랙 먼저)
      audioTracks.forEach(track => {
        this.peerConnection?.addTrack(track, newStream);
      });

      // 비디오 트랙 추가
      const videoTracks = newStream.getVideoTracks();
      videoTracks.forEach(track => {
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
      // 기존 비디오 트랙 정리
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSenders = senders.filter(sender =>
          sender.track?.kind === 'video'
        );

        for (const sender of videoSenders) {
          if (sender.track) {
            sender.track.stop();
            this.peerConnection.removeTrack(sender);
          }
        }
      }

      // 화면 공유 스트림 얻기
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });

      // 기존 오디오 스트림 사용
      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack && !screenStream.getAudioTracks().length) {
        // 기존 오디오 트랙을 그대로 사용 (클론하지 않음)
        screenStream.addTrack(audioTrack);
      }

      // 화면 공유가 취소되었을 때의 처리
      screenStream.getVideoTracks()[0].onended = () => {
        const currentUser = useAuthStore.getState().user;
        const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;

        if (currentUser?.email && currentChannelId) {
          useUserChannelStore.getState().updateUserMediaState(
            currentChannelId,
            currentUser.email,
            {
              isScreenSharing: false,
              screenStream: null
            }
          );

          // 화면 공유 트랙만 제거
          if (this.peerConnection) {
            const senders = this.peerConnection.getSenders();
            const screenSender = senders.find(sender =>
              sender.track?.kind === 'video' &&
              sender.track.label.includes('screen')
            );
            if (screenSender) {
              screenSender.track?.stop();
              this.peerConnection.removeTrack(screenSender);
            }
          }
        }
      };

      // WebRTC 연결에 트랙 추가
      if (this.peerConnection) {
        const videoTrack = screenStream.getVideoTracks()[0];
        this.peerConnection.addTrack(videoTrack, screenStream);

        // 화면 공유 스트림 품질 최적화 설정
        const sender = this.peerConnection.getSenders().find(s => s.track === videoTrack);
        if (sender) {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 3000000; // 3Mbps
          await sender.setParameters(params);
        }

        // localStream 업데이트 (기존 오디오 트랙 유지)
        this.localStream = screenStream;
      }

      return screenStream;
    } catch (error) {
      if (error instanceof Error &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        return null;
      }
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  async stopScreenShare() {
    if (!this.peerConnection) return;

    try {
      // 화면 공유 비디오 트랙만 찾아서 제거
      const senders = this.peerConnection.getSenders();
      const screenSenders = senders.filter(sender =>
        sender.track?.kind === 'video' &&
        sender.track.readyState === 'live' &&
        sender.track.label.includes('screen')
      );

      // 화면 공유 트랙만 제거
      for (const sender of screenSenders) {
        if (sender.track) {
          sender.track.stop();
        }
        this.peerConnection.removeTrack(sender);
      }

      // 기존 localStream에서 비디오 트랙만 제거
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          this.localStream?.removeTrack(track);
        });
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  disconnect() {
    // 확실한 오디오 감지 정리
    this.cleanupAudioDetection();
    this.reset();

    // 모든 미디어 트랙 정리를 보장하는 함수
    const cleanupMediaTracks = () => {
      // localStream 정리
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.enabled = false;  // 먼저 비활성화
          track.stop();  // 그 다음 정지
        });
        this.localStream = null;
      }

      // PeerConnection의 모든 트랙 정리
      if (this.peerConnection) {
        this.peerConnection.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.enabled = false;
            sender.track.stop();
          }
        });

        // 모든 트랜시버 정지
        this.peerConnection.getTransceivers().forEach(transceiver => {
          transceiver.stop();
        });

        this.peerConnection.close();
        this.peerConnection = null;
      }
    };

    // 오디오 감지 인터벌 정리
    if (this.audioDetectionInterval) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }

    // 실행 보장을 위해 setTimeout으로 한번 더 실행
    cleanupMediaTracks();
    setTimeout(cleanupMediaTracks, 100);
  }

  dispose() {
    this.disconnect();
    MediaServerConnection.instance = null;
  }
}