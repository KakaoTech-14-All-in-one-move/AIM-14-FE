import { useUserChannelStore } from '@/stores/userChannelStore';
import { CallConnection } from '../socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { OP_CODES } from '@/services/call/constants';

export class MediaServerConnection {
  private audioDetectionInterval: number | null = null;
  private static instance: MediaServerConnection | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private callConnection: CallConnection | null = null;
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private reconnectionAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;
  private readonly ICE_RECONNECTION_TIMEOUT = 3000;

  private connectionStates: Map<string, {
    isRemoteDescriptionSet: boolean;
    isConnecting: boolean;
    isNegotiating: boolean;
  }> = new Map();

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

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private parseKurentoStreamId(streamId: string, remotePeerId?: string): { userId: string; endpointId: string } | null {
    // default 스트림인 경우, remotePeerId 필수 체크
    if (streamId === 'default') {
      if (!remotePeerId) {
        console.error('RemotePeerId is required for default stream');
        return null;
      }
      return {
        endpointId: streamId,
        userId: remotePeerId,
      };
    }

    // 기존 로직
    const parts = streamId.split('_');
    if (parts.length !== 2) return null;

    return {
      endpointId: parts[0],
      userId: parts[1],
    };
  }

  async prepareConnection(channelId: string, remotePeerId: string) {
    await this.cleanupExistingConnection(remotePeerId);

    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.user_id) {
      throw new Error('No user found');
    }

    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: true,
      isNegotiating: false,
    });

    const userId = currentUser.user_id.toString();

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10,
    });

    this.peerConnections.set(remotePeerId, peerConnection);
    this.setupPeerConnectionHandlers(channelId, userId, remotePeerId);

    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();

      audioTracks.forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });

      videoTracks.forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }
  }

  private setupPeerConnectionHandlers(channelId: string, userId: string, remotePeerId: string) {
    console.log('Setting up peer connection handlers:', {
      channelId,
      userId,
      remotePeerId,
    });

    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) return;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.toJSON(),
          sdp_mid: event.candidate.sdpMid,
          sdp_m_line_index: event.candidate.sdpMLineIndex,
          remote_peer_id: remotePeerId,
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`ICE connection state for ${remotePeerId}: ${state}`);
      console.log(`Connection state: ${peerConnection.connectionState}`);

      switch (state) {
        case 'failed':
          if (peerConnection.connectionState !== 'failed') {
            console.warn(`ICE connection failed for ${remotePeerId} - attempting restart`);
            peerConnection.restartIce();
          }
          break;
        case 'disconnected':
          if (peerConnection.connectionState === 'connected') {
            console.log('Temporary disconnection detected, waiting before reconnection attempt');
            setTimeout(() => {
              if (peerConnection.iceConnectionState === 'disconnected' &&
                peerConnection.connectionState !== 'connected') {
                this.attemptReconnection(remotePeerId, channelId);
              }
            }, this.ICE_RECONNECTION_TIMEOUT);
          }
          break;
        case 'connected':
          console.log(`ICE Connection established with ${remotePeerId}`);
          break;
      }
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        console.warn('Received track without stream');
        return;
      }

      // 디버깅 정보 로깅
      console.log('====== Stream Debug Info ======');
      console.log('Stream ID:', stream.id);
      console.log('Track Info:', {
        kind: event.track.kind,
        id: event.track.id,
        label: event.track.label,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        remotePeerId
      });

      // 트랙 이벤트 핸들러
      const cleanupTrack = () => {
        if (event.track.kind === 'audio') {
          this.cleanupAudioDetection(remotePeerId);
        }
      };

      event.track.onended = () => {
        console.log(`Remote track ended: ${event.track.kind}`);
        this.handleTrackEnded(event.track, stream, channelId, remotePeerId);
        cleanupTrack();
      };

      event.track.onmute = () => {
        console.log(`Remote track muted: ${event.track.kind}`);
      };

      event.track.onunmute = () => {
        console.log(`Remote track unmuted: ${event.track.kind}`);
      };

      // 스트림 데이터 파싱
      let streamData = stream.id === 'default' ?
        { userId: remotePeerId, endpointId: stream.id } :
        this.parseKurentoStreamId(stream.id, remotePeerId);

      if (!streamData || !streamData.userId) {
        console.error('Invalid stream data:', { streamId: stream.id, remotePeerId });
        return;
      }

      // 채널 사용자 확인
      const users = useUserChannelStore.getState().channelUsers.get(channelId);
      if (!users) {
        console.error('No users found in channel:', channelId);
        return;
      }

      const userExists = users.some(u => u.userId === streamData.userId);
      if (!userExists) {
        console.warn(`User ${streamData.userId} not found in channel ${channelId}`);
        return;
      }

      // 스트림 상태 업데이트
      const isScreenShare = stream.id.includes('screenshare');
      useUserChannelStore.getState().updateUserMediaState(
        channelId,
        streamData.userId,
        isScreenShare ? { screenStream: stream } : { stream }
      );

      // 오디오 감지 설정
      if (event.track.kind === 'audio' && !isScreenShare) {
        this.setupRemoteAudioDetection(stream, streamData.userId);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state for ${remotePeerId}: ${state}`);

      switch (state) {
        case 'connected':
          console.log(`Successfully connected to peer ${remotePeerId}`);
          const connectionState = this.connectionStates.get(remotePeerId);
          if (connectionState) {
            connectionState.isConnecting = false;
          }
          this.reconnectionAttempts.set(remotePeerId, 0);
          break;
        case 'failed':
        case 'disconnected':
          const attempts = this.reconnectionAttempts.get(remotePeerId) || 0;
          if (attempts < this.MAX_RECONNECTION_ATTEMPTS) {
            console.warn(`Connection issue with ${remotePeerId} (attempt ${attempts + 1}/${this.MAX_RECONNECTION_ATTEMPTS})`);
            this.attemptReconnection(remotePeerId, channelId);
          } else {
            console.error(`Max reconnection attempts reached for ${remotePeerId}`);
            this.cleanupExistingConnection(remotePeerId);
          }
          break;
        case 'closed':
          console.log(`Connection closed for ${remotePeerId}`);
          this.resetConnectionState(remotePeerId);
          break;
      }
    };

    peerConnection.onnegotiationneeded = async () => {
      const connectionState = this.connectionStates.get(remotePeerId);
      if (!connectionState) {
        console.error('No connection state found for:', remotePeerId);
        return;
      }

      if (connectionState.isConnecting || connectionState.isNegotiating) {
        console.log('Skipping negotiation - already in progress');
        return;
      }

      try {
        connectionState.isNegotiating = true;
        await this.renegotiateConnection(remotePeerId);
      } catch (error) {
        console.error('Negotiation failed:', error);
        this.resetConnectionState(remotePeerId);
      } finally {
        if (connectionState) {
          connectionState.isNegotiating = false;
        }
      }
    };
  }

  async connectToAllUsers(channelId: string) {
    const users = useUserChannelStore.getState().channelUsers.get(channelId);
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    if (!currentUserId) return;

    // 자신을 제외한 다른 참가자들의 스트림을 받기 위한 연결만 생성
    for (const user of users || []) {
      if (user.userId !== currentUserId) {
        await this.prepareConnection(channelId, user.userId);
        const currentUser = useAuthStore.getState().user;
        if (!currentUser?.user_id) continue;
        await this.createVideoOffer(user.userId);
      }
    }
  }

  async handleNewUser(channelId: string, newUserId: string) {
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId) || [];

    // 자신이거나 채널에 혼자인 경우 WebRTC 연결 생성하지 않음
    if (newUserId === currentUserId || channelUsers.length <= 1) {
      return;
    }

    await this.prepareConnection(channelId, newUserId);
    await this.createVideoOffer(newUserId);
  }

  private handleTrackEnded(track: MediaStreamTrack, stream: MediaStream, channelId: string, remotePeerId: string) {
    const streamData = this.parseKurentoStreamId(stream.id, remotePeerId);
    if (!streamData) return;

    const { userId } = streamData;
    const isScreenShare = stream.id.includes('screenshare');

    if (isScreenShare && track.kind === 'video') {
      useUserChannelStore.getState().updateUserMediaState(channelId, userId, {
        isScreenSharing: false,
        screenStream: null,
      });
    }
  }

  private async renegotiateConnection(remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);
    const currentUserId = useAuthStore.getState().user?.user_id.toString();

    if (!peerConnection || !connectionState || connectionState.isNegotiating) {
      console.log('Negotiation already in progress or no peer connection');
      return;
    }

    try {
      connectionState.isNegotiating = true;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: currentUserId,  // 현재 사용자 ID로 변경
      });
    } catch (error) {
      console.error('Renegotiation failed:', error);
    } finally {
      connectionState.isNegotiating = false;
    }
  }

  async createVideoOffer(remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection || !connectionState?.isConnecting) {
      throw new Error('Connection not prepared');
    }

    if (connectionState.isNegotiating) {
      console.log('Negotiation already in progress, skipping offer creation');
      return;
    }

    try {
      connectionState.isNegotiating = true;
      console.log('Creating offer for:', remotePeerId);

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      console.log('Setting local description');
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: useAuthStore.getState().user?.user_id.toString()
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      this.resetConnectionState(remotePeerId);
      throw error;
    } finally {
      connectionState.isNegotiating = false;
    }
  }

  private resetConnectionState(remotePeerId: string) {
    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: false,
      isNegotiating: false,
    });
    this.pendingCandidates.set(remotePeerId, []);
  }

  async handleRemoteAnswer(sdp: string, remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection) {
      console.warn('Ignoring remote answer - no peer connection');
      return;
    }

    // 추가: 이미 stable 상태인 경우의 처리
    if (peerConnection.signalingState === 'stable') {
      console.warn('Connection already stable, ignoring answer');
      return;
    }

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp,
        }),
      );

      // 연결 상태 업데이트
      if (connectionState) {
        connectionState.isRemoteDescriptionSet = true;
        connectionState.isConnecting = false;
      }

      // 대기 중인 ICE candidate 처리
      const candidates = this.pendingCandidates.get(remotePeerId) || [];
      while (candidates.length > 0) {
        const candidate = candidates.shift()!;
        await this.addIceCandidate(candidate, remotePeerId);
      }
    } catch (error) {
      console.error('Error setting remote description:', error);
      this.resetConnectionState(remotePeerId);
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit, remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection || !connectionState?.isConnecting) return;

    try {
      if (connectionState.isRemoteDescriptionSet) {
        await this.addIceCandidate(candidate, remotePeerId);
      } else {
        const candidates = this.pendingCandidates.get(remotePeerId) || [];
        candidates.push(candidate);
        this.pendingCandidates.set(remotePeerId, candidates);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private async addIceCandidate(candidate: RTCIceCandidateInit, remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) {
      console.warn('No peer connection for:', remotePeerId);
      return;
    }

    try {
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Added ICE candidate for:', remotePeerId);
      } else {
        console.warn('Queueing ICE candidate - no remote description');
        const candidates = this.pendingCandidates.get(remotePeerId) || [];
        candidates.push(candidate);
        this.pendingCandidates.set(remotePeerId, candidates);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  private async attemptReconnection(remotePeerId: string, channelId: string) {
    const attempts = this.reconnectionAttempts.get(remotePeerId) || 0;
    if (attempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      console.error(`Max reconnection attempts reached for ${remotePeerId}`);
      return;
    }

    this.reconnectionAttempts.set(remotePeerId, attempts + 1);

    try {
      await this.cleanupExistingConnection(remotePeerId);
      await this.prepareConnection(channelId, remotePeerId);
      await this.createVideoOffer(remotePeerId);
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  private async cleanupExistingConnection(remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (peerConnection) {
      peerConnection.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });

      peerConnection.close();
      this.peerConnections.delete(remotePeerId);
    }

    this.resetConnectionState(remotePeerId);
    await new Promise(resolve => setTimeout(resolve, 100));
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

  async replaceStream(newStream: MediaStream) {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    this.localStream = newStream;

    for (const [remotePeerId, peerConnection] of this.peerConnections) {
      const transceivers = peerConnection.getTransceivers();
      for (const transceiver of transceivers) {
        if (transceiver.sender.track) {
          const trackKind = transceiver.sender.track.kind;
          const newTrack = newStream.getTracks().find(t => t.kind === trackKind);
          if (newTrack) {
            await transceiver.sender.replaceTrack(newTrack);
          }
        }
      }

      const currentTracks = transceivers.map(t => t.sender.track?.kind);
      newStream.getTracks().forEach(track => {
        if (!currentTracks.includes(track.kind)) {
          peerConnection.addTrack(track, newStream);
        }
      });

      await this.renegotiateConnection(remotePeerId);
    }

    const audioTracks = newStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.setupLocalAudioDetection(newStream);
    }
  }

  async handleCameraState(isCameraOn: boolean) {
    try {
      if (isCameraOn) {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });

        const combinedStream = new MediaStream();

        const currentStream = this.getLocalStream();
        if (currentStream) {
          currentStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
          });
        }

        videoStream.getVideoTracks().forEach(track => {
          combinedStream.addTrack(track);
        });

        await this.replaceStream(combinedStream);
        return { stream: combinedStream };
      } else {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        await this.replaceStream(audioStream);
        return { stream: audioStream };
      }
    } catch (error) {
      console.error('Error handling camera state:', error);
      throw error;
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
          frameRate: { ideal: 30 },
        },
      });

      for (const [remotePeerId, peerConnection] of this.peerConnections) {
        // 기존 비디오 트랙 제거
        const senders = peerConnection.getSenders();
        const videoSenders = senders.filter(sender =>
          sender.track?.kind === 'video',
        );

        for (const sender of videoSenders) {
          if (sender.track) {
            sender.track.stop();
            peerConnection.removeTrack(sender);
          }
        }

        // 화면 공유 트랙 추가
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.addTrack(videoTrack, screenStream);

        // 품질 최적화 설정
        const params = sender.getParameters();
        if (!params.encodings) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 3000000; // 3Mbps
        params.encodings[0].maxFramerate = 30;
        await sender.setParameters(params);
      }

// 화면 공유 종료 이벤트 처리
      const videoTrack = screenStream.getVideoTracks()[0];
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
              screenStream: null,
            },
          );
        }
      };

// 모든 peer와 재협상
      for (const [remotePeerId] of this.peerConnections) {
        await this.renegotiateConnection(remotePeerId);
      }

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
    try {
      for (const [remotePeerId, peerConnection] of this.peerConnections) {
        const senders = peerConnection.getSenders();
        const screenSenders = senders.filter(sender =>
          sender.track?.kind === 'video' &&
          sender.track.readyState === 'live' &&
          sender.track.label.includes('screen'),
        );

        for (const sender of screenSenders) {
          if (sender.track) {
            sender.track.stop();
          }
          peerConnection.removeTrack(sender);
        }

        await this.renegotiateConnection(remotePeerId);
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
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

    // 모든 peer connection 정리
    for (const [remotePeerId, peerConnection] of this.peerConnections) {
      peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.enabled = false;
          sender.track.stop();
        }
      });

      peerConnection.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });
      peerConnection.close();
    }

    this.peerConnections.clear();
    this.connectionStates.clear();
    this.pendingCandidates.clear();
    this.reconnectionAttempts.clear();

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