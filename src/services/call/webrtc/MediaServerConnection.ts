import { useUserChannelStore } from '@/stores/userChannelStore';
import { CallConnection } from '../socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { OP_CODES } from '@/services/call/constants';

export class MediaServerConnection {
  private audioDetectionInterval: number | null = null;
  private static instance: MediaServerConnection | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callConnection: CallConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;
  private readonly ICE_RECONNECTION_TIMEOUT = 3000;

  private connectionState = {
    isRemoteDescriptionSet: false,
    isConnecting: false,
  };

  private audioContextMap: Map<string, {
    context: AudioContext;
    analyser: AnalyserNode;
    dataArray: Uint8Array;
  }> = new Map();

  private constructor() {}

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
    await this.cleanupExistingConnection();

    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.user_id) {
      throw new Error('No user found');
    }

    this.connectionState.isConnecting = true;
    const userId = currentUser.user_id.toString();

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10
    });

    this.setupPeerConnectionHandlers(channelId, userId);

    // 로컬 스트림이 있다면 추가
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

  private setupPeerConnectionHandlers(channelId: string, userId: string) {
    if (!this.peerConnection) return;

    // ICE candidate 핸들링
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.toJSON(),
          name: userId,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };

    // ICE 연결 상태 모니터링
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log(`ICE connection state: ${state}`);

      switch (state) {
        case 'failed':
          if (this.peerConnection) {
            this.peerConnection.restartIce();
            console.warn('ICE connection failed - attempting restart');
          }
          break;
        case 'disconnected':
          setTimeout(() => {
            if (this.peerConnection?.iceConnectionState === 'disconnected') {
              this.attemptReconnection();
            }
          }, this.ICE_RECONNECTION_TIMEOUT);
          break;
      }
    };

    // 원격 스트림 수신 처리
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        console.warn('Received track without stream');
        return;
      }

      // track 이벤트 처리
      event.track.onended = () => {
        console.log(`Remote track ended: ${event.track.kind}`);
        this.handleTrackEnded(event.track, stream, channelId);
      };

      event.track.onmute = () => {
        console.log(`Remote track muted: ${event.track.kind}`);
      };

      event.track.onunmute = () => {
        console.log(`Remote track unmuted: ${event.track.kind}`);
      };

      const streamData = this.parseKurentoStreamId(stream.id);
      if (!streamData) {
        console.error('Invalid stream ID format');
        return;
      }

      const { userId: remoteUserId } = streamData;
      const users = useUserChannelStore.getState().channelUsers.get(channelId);
      const userExists = users?.some(u => u.userId === remoteUserId);

      if (!userExists) {
        console.warn(`User ${remoteUserId} not found in store`);
        return;
      }

      const isScreenShare = stream.id.includes('screenshare');
      useUserChannelStore.getState().updateUserMediaState(
        channelId,
        remoteUserId,
        isScreenShare ? { screenStream: stream } : { stream }
      );

      if (event.track.kind === 'audio' && !isScreenShare) {
        this.setupRemoteAudioDetection(stream, remoteUserId);
      }
    };

    // 연결 상태 모니터링
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`Connection state: ${state}`);

      switch (state) {
        case 'connected':
          console.log('Successfully connected to media server');
          this.connectionState.isConnecting = false;
          this.reconnectionAttempts = 0;
          break;
        case 'failed':
        case 'disconnected':
          if (this.reconnectionAttempts < this.MAX_RECONNECTION_ATTEMPTS) {
            console.warn(`Connection issue (attempt ${this.reconnectionAttempts + 1}/${this.MAX_RECONNECTION_ATTEMPTS})`);
            this.attemptReconnection();
          } else {
            console.error('Max reconnection attempts reached');
          }
          break;
        case 'closed':
          console.log('Connection closed');
          this.resetConnectionState();
          break;
      }
    };

    // 협상 필요 이벤트
    this.peerConnection.onnegotiationneeded = async () => {
      if (!this.connectionState.isConnecting) {
        try {
          this.connectionState.isConnecting = true;
          await this.renegotiate();
        } catch (error) {
          console.error('Negotiation failed:', error);
          this.connectionState.isConnecting = false;
        }
      }
    };
  }

  private handleTrackEnded(track: MediaStreamTrack, stream: MediaStream, channelId: string) {
    const streamData = this.parseKurentoStreamId(stream.id);
    if (!streamData) return;

    const { userId } = streamData;
    const isScreenShare = stream.id.includes('screenshare');

    if (isScreenShare && track.kind === 'video') {
      useUserChannelStore.getState().updateUserMediaState(channelId, userId, {
        isScreenSharing: false,
        screenStream: null
      });
    }
  }

  private parseKurentoStreamId(streamId: string): { userId: string; endpointId: string } | null {
    const parts = streamId.split('_');
    if (parts.length !== 2) return null;

    return {
      endpointId: parts[0],
      userId: parts[1]
    };
  }

  async connect() {
    if (!this.peerConnection || !this.connectionState.isConnecting) {
      throw new Error('Connection not prepared');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      this.resetConnectionState();
      throw error;
    }
  }

  private resetConnectionState() {
    this.connectionState = {
      isRemoteDescriptionSet: false,
      isConnecting: false
    };
    this.pendingCandidates = [];
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
          sdp
        })
      );

      this.connectionState.isRemoteDescriptionSet = true;

      // Process pending candidates
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift()!;
        await this.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error setting remote description:', error);
      this.resetConnectionState();
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection || !this.connectionState.isConnecting) return;

    try {
      if (this.connectionState.isRemoteDescriptionSet) {
        await this.addIceCandidate(candidate);
      } else {
        this.pendingCandidates.push(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      throw error;
    }
  }

  private setupAudioDetection(stream: MediaStream, userId: string) {
    try {
      if (!stream.getAudioTracks().length) {
        console.warn('No audio tracks found in stream');
        return;
      }

      this.cleanupAudioDetection(userId);

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      source.connect(analyser);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioContextMap.set(userId, { context: audioContext, analyser, dataArray });

      if (!this.audioDetectionInterval) {
        this.audioDetectionInterval = window.setInterval(() => {
          this.checkAudioLevels();
        }, 50);
      }
    } catch (error) {
      console.error('Failed to setup audio detection:', error);
      this.cleanupAudioDetection(userId);
    }
  }

  private checkAudioLevels() {
    this.audioContextMap.forEach((audio, uid) => {
      try {
        const { analyser, dataArray } = audio;
        analyser.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;
        const threshold = 15;
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
      } catch (error) {
        console.error('Error in audio level detection:', error);
      }
    });
  }

  private setupLocalAudioDetection(stream: MediaStream) {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.user_id) return;

    this.setupAudioDetection(stream, currentUser.user_id.toString());
  }

  private setupRemoteAudioDetection(stream: MediaStream, userId: string) {
    this.setupAudioDetection(stream, userId);
  }

  private cleanupAudioDetection(userId?: string) {
    if (userId) {
      const audioContext = this.audioContextMap.get(userId);
      if (audioContext) {
        audioContext.context.close();
        this.audioContextMap.delete(userId);
      }
    } else {
      this.audioContextMap.forEach((audio) => audio.context.close());
      this.audioContextMap.clear();
    }

    if (this.audioContextMap.size === 0 && this.audioDetectionInterval) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async replaceStream(newStream: MediaStream) {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    this.localStream = newStream;

    if (this.peerConnection) {
      // 트랜시버 처리
      const transceivers = this.peerConnection.getTransceivers();
      for (const transceiver of transceivers) {
        if (transceiver.sender.track) {
          const trackKind = transceiver.sender.track.kind;
          const newTrack = newStream.getTracks().find(t => t.kind === trackKind);
          if (newTrack) {
            await transceiver.sender.replaceTrack(newTrack);
          }
        }
      }

      // 새로운 트랙 추가
      const currentTracks = transceivers.map(t => t.sender.track?.kind);
      newStream.getTracks().forEach(track => {
        if (!currentTracks.includes(track.kind)) {
          this.peerConnection?.addTrack(track, newStream);
        }
      });

      await this.renegotiate();
    }

    const audioTracks = newStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.setupLocalAudioDetection(newStream);
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });

      if (!this.peerConnection) return null;

      // 기존 비디오 트랙 제거
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

      // 화면 공유 트랙 추가
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = this.peerConnection.addTrack(videoTrack, screenStream);

      // 품질 최적화 설정
      const params = sender.getParameters();
      if (!params.encodings) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = 3000000; // 3Mbps
      params.encodings[0].maxFramerate = 30;
      await sender.setParameters(params);

      // 화면 공유 종료 이벤트 처리
      videoTrack.onended = () => {
        this.stopScreenShare();
        const currentUser = useAuthStore.getState().user;
        const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;
        if (currentUser?.user_id && currentChannelId) {
          useUserChannelStore.getState().updateUserMediaState(
            currentChannelId,
            currentUser.user_id.toString(),
            {
              isScreenSharing: false,
              screenStream: null
            }
          );
        }
      };

      await this.renegotiate();
      return screenStream;
    } catch (error) {
      if (error instanceof Error &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        console.log('Screen share cancelled by user');
        return null;
      }
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  async stopScreenShare() {
    if (!this.peerConnection) return;

    try {
      const senders = this.peerConnection.getSenders();
      const screenSenders = senders.filter(sender =>
        sender.track?.kind === 'video' &&
        sender.track.readyState === 'live' &&
        sender.track.label.includes('screen')
      );

      for (const sender of screenSenders) {
        if (sender.track) {
          sender.track.stop();
        }
        this.peerConnection.removeTrack(sender);
      }

      await this.renegotiate();
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  private async renegotiate() {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp
      });
    } catch (error) {
      console.error('Renegotiation failed:', error);
    }
  }

  private async attemptReconnection() {
    if (this.reconnectionAttempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectionAttempts++;

    try {
      await this.cleanupExistingConnection();
      const currentChannelId = useUserChannelStore.getState().currentUserChannel.channelId;
      if (currentChannelId) {
        await this.prepareConnection(currentChannelId);
        await this.connect();
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  private async cleanupExistingConnection() {
    if (this.peerConnection) {
      // 모든 트랜시버 정지
      this.peerConnection.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });

      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.resetConnectionState();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  disconnect() {
    this.cleanupAudioDetection();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.enabled = false;
        track.stop();
      });
      this.localStream = null;
    }

    if (this.peerConnection) {
      // 모든 sender의 트랙 정리
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

    this.resetConnectionState();

    // 실행 보장을 위해 setTimeout으로 한번 더 실행
    setTimeout(() => {
      this.cleanupAudioDetection();
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
        this.localStream = null;
      }
    }, 100);
  }

  dispose() {
    this.disconnect();
    MediaServerConnection.instance = null;
  }
}