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
  private audioContextMap: Map<
    string,
    {
      context: AudioContext;
      analyser: AnalyserNode;
      dataArray: Uint8Array;
    }
  > = new Map();

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
      audioTracks.forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 비디오 트랙 나중에 추가
      videoTracks.forEach((track) => {
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
    await new Promise((resolve) => setTimeout(resolve, 100));
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

    // Kurento의 경우 ontrack은 다른 참가자들의 스트림을 수신할 때 발생
    this.peerConnection.ontrack = (event) => {
      const { streams, track } = event;
      if (!streams.length) {
        console.warn('Received track without stream');
        return;
      }

      const stream = streams[0];
      console.log('Received remote stream:', stream.id);

      // Kurento에서는 streamId 형식이 [ENDPOINT_ID]_[USER_ID] 형태일 수 있음
      const streamData = this.parseKurentoStreamId(stream.id);
      if (!streamData) {
        console.error('Invalid stream ID format from Kurento');
        return;
      }

      const { userId, endpointId } = streamData;
      console.log(`Processing stream for user ${userId} from endpoint ${endpointId}`);

      // 채널 사용자 확인
      const users = useUserChannelStore.getState().channelUsers.get(channelId);
      const userExists = users?.some(u => u.userId === userId);

      if (!userExists) {
        console.warn(`User ${userId} not yet in store. Caching stream...`);
        // 필요한 경우 스트림을 임시 저장하는 로직 추가
        return;
      }

      try {
        // Kurento의 경우 스크린쉐어는 별도의 엔드포인트로 처리될 수 있음
        const isScreenShare = endpointId.includes('screenshare');

        useUserChannelStore.getState().updateUserMediaState(
          channelId,
          userId,
          isScreenShare ? { screenStream: stream } : { stream },
        );

        if (track.kind === 'audio' && !isScreenShare) {
          this.setupRemoteAudioDetection(stream, userId);
        }

        console.log(`Updated ${isScreenShare ? 'screen share' : 'media'} stream for user: ${userId}`);
      } catch (error) {
        console.error('Error updating media state:', error);
      }
    };

    // Kurento의 ICE candidate 처리
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Kurento로 ICE candidate 전송
        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.toJSON(),
          sdp_mid: event.candidate.sdpMid,
          sdp_m_line_index: event.candidate.sdpMLineIndex,
        });
      }
    };

    // Kurento와의 연결 상태 모니터링
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`Kurento Connection State → ${state}`);

      switch (state) {
        case 'connected':
          console.log('✓ Connected to Kurento Media Server');
          this.connectionState.isConnecting = false;
          break;
        case 'disconnected':
        case 'failed':
          console.warn('Kurento connection issue - attempting recovery');
          this.attemptKurentoReconnection();
          break;
        case 'closed':
          console.log('Kurento connection closed');
          this.reset();
          break;
      }
    };

    // ICE 연결 상태 처리
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log(`ICE Connection State with Kurento → ${state}`);

      if (state === 'failed') {
        console.warn('ICE connection with Kurento failed - attempting restart');
        this.restartKurentoConnection();
      }
    };

    // Kurento의 경우 협상은 서버 주도로 이루어질 수 있음
    this.peerConnection.onnegotiationneeded = async () => {
      console.log('Negotiation needed with Kurento');
      if (!this.connectionState.isConnecting) {
        try {
          this.connectionState.isConnecting = true;
          await this.connect();
        } catch (error) {
          console.error('Error during Kurento negotiation:', error);
          this.connectionState.isConnecting = false;
        }
      }
    };
  }

  private parseKurentoStreamId(streamId: string): { userId: string; endpointId: string } | null {
    // Kurento의 streamId 형식에 맞게 파싱
    // 예: "endpoint123_user456" => { endpointId: "endpoint123", userId: "user456" }
    const parts = streamId.split('_');
    if (parts.length !== 2) return null;

    return {
      endpointId: parts[0],
      userId: parts[1],
    };
  }

  private async attemptKurentoReconnection() {
    try {
      // 기존 연결 정리
      await this.cleanupExistingConnection();

      // 새로운 연결 시도
      await this.prepareConnection(useUserChannelStore.getState().currentUserChannel.channelId);
      await this.connect();
    } catch (error) {
      console.error('Failed to reconnect to Kurento:', error);
    }
  }

  private async restartKurentoConnection() {
    try {
      if (this.peerConnection) {
        await this.peerConnection.restartIce();
        console.log('ICE restart initiated with Kurento');
      }
    } catch (error) {
      console.error('Failed to restart Kurento ICE:', error);
      await this.attemptKurentoReconnection();
    }
  }

  private setupLocalAudioDetection(stream: MediaStream) {
    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser?.user_id) {
        console.error('Invalid user data:', currentUser);
        return;
      }

      const userId = currentUser.user_id.toString();
      console.log('Setting up local audio detection for user:', userId);

      // 스트림 유효성 검사
      if (!stream || !stream.getAudioTracks().length) {
        console.error('Invalid audio stream');
        return;
      }

      // 기존 오디오 감지 정리
      this.cleanupAudioDetection(userId);

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      // 오디오 처리 파이프라인 설정
      source.connect(analyser);

      // FFT 설정
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioContextMap.set(userId, {
        context: audioContext,
        analyser,
        dataArray,
      });

      if (!this.audioDetectionInterval) {
        this.audioDetectionInterval = window.setInterval(() => {
          this.audioContextMap.forEach((audio, uid) => {
            try {
              const { analyser, dataArray } = audio;
              analyser.getByteFrequencyData(dataArray);

              const sum = dataArray.reduce((a, b) => a + b, 0);
              const average = sum / dataArray.length;
              const isSpeaking = average > 15;

              const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;
              if (!currentChannelId) {
                console.warn('No current channel ID found');
                return;
              }

              const users = useUserChannelStore.getState().channelUsers.get(currentChannelId);
              const userState = users?.find((user) => user.userId === uid);

              if (!userState) {
                console.warn(`User state not found for: ${uid} in channel: ${currentChannelId}`);
                return;
              }

              if (userState.mediaState.isSpeaking !== isSpeaking) {
                useUserChannelStore.getState().updateUserMediaState(
                  currentChannelId,
                  uid,
                  { isSpeaking },
                );
              }
            } catch (error) {
              console.error('Error in audio detection interval for user:', uid, error);
            }
          });
        }, 50);
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
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp,
        }),
      );

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

      // 오디오 처리 파이프라인 설정 - analyser에만 연결
      source.connect(analyser);

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

            const currentState = useUserChannelStore
              .getState()
              .channelUsers.get(currentChannelId)
              ?.find((user) => user.userId === uid)?.mediaState.isSpeaking;

            if (currentState !== isSpeaking) {
              useUserChannelStore
                .getState()
                .updateUserMediaState(currentChannelId, uid, { isSpeaking });
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
      this.audioContextMap.forEach((audio) => audio.context.close());
      this.audioContextMap.clear();
    }

    // 모든 오디오 컨텍스트가 제거되었다면 인터벌도 정리
    if (this.audioContextMap.size === 0 && this.audioDetectionInterval) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  replaceStream(newStream: MediaStream) {
    // 기존 트랙 중지 및 제거
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop(); // 모든 트랙 확실히 중지
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
      senders.forEach((sender) => {
        this.peerConnection?.removeTrack(sender);
      });

      // 새 트랙 추가 (오디오 트랙 먼저)
      audioTracks.forEach((track) => {
        this.peerConnection?.addTrack(track, newStream);
      });

      // 비디오 트랙 추가
      const videoTracks = newStream.getVideoTracks();
      videoTracks.forEach((track) => {
        this.peerConnection?.addTrack(track, newStream);
      });
    }
  }

  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      // 기존 비디오 트랙 정리
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSenders = senders.filter((sender) => sender.track?.kind === 'video');

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
          frameRate: { ideal: 30 },
        },
      });

      // 화면 공유가 취소되었을 때의 처리
      screenStream.getVideoTracks()[0].onended = () => {
        const currentUser = useAuthStore.getState().user;
        const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;

        if (currentUser?.email && currentChannelId) {
          useUserChannelStore
            .getState()
            .updateUserMediaState(currentChannelId, currentUser.user_id.toString(), {
              isScreenSharing: false,
              screenStream: null,
            });

          // 화면 공유 트랙만 제거
          if (this.peerConnection) {
            const senders = this.peerConnection.getSenders();
            const screenSender = senders.find(
              (sender) => sender.track?.kind === 'video' && sender.track.label.includes('screen'),
            );
            if (screenSender) {
              screenSender.track?.stop();
              this.peerConnection.removeTrack(screenSender);
            }
          }
        }
      };

      // 새로운 결합된 스트림 생성
      const combinedStream = new MediaStream();

      // 기존 오디오 스트림 유지
      const currentStream = this.getLocalStream();
      if (currentStream) {
        currentStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      // 새로운 화면 공유 비디오 트랙 추가
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      // WebRTC 연결에 트랙 추가
      if (this.peerConnection) {
        const videoTrack = screenStream.getVideoTracks()[0];
        this.peerConnection.addTrack(videoTrack, combinedStream);

        // 화면 공유 스트림 품질 최적화 설정
        const sender = this.peerConnection.getSenders().find((s) => s.track === videoTrack);
        if (sender) {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 3000000; // 3Mbps
          await sender.setParameters(params);
        }

        // localStream 업데이트
        this.localStream = combinedStream;
      }

      return screenStream;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError')
      ) {
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
      const screenSenders = senders.filter(
        (sender) =>
          sender.track?.kind === 'video' &&
          sender.track.readyState === 'live' &&
          sender.track.label.includes('screen'),
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
        videoTracks.forEach((track) => {
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
        this.localStream.getTracks().forEach((track) => {
          track.enabled = false; // 먼저 비활성화
          track.stop(); // 그 다음 정지
        });
        this.localStream = null;
      }

      // PeerConnection의 모든 트랙 정리
      if (this.peerConnection) {
        this.peerConnection.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = false;
            sender.track.stop();
          }
        });

        // 모든 트랜시버 정지
        this.peerConnection.getTransceivers().forEach((transceiver) => {
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
