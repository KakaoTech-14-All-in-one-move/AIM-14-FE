import { useUserChannelStore } from '@/stores/userChannelStore';
import { CallConnection } from '../socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { OP_CODES } from '@/services/call/constants';

export class MediaServerConnection {
  private audioDetectionInterval: number | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private reconnectionAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;
  private readonly ICE_RECONNECTION_TIMEOUT = 3000;
  private static instance: MediaServerConnection | null = null;
  private callConnection: CallConnection | null = null;
  private readonly connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;

  private connectionStates: Map<string, {
    isRemoteDescriptionSet: boolean;
    isConnecting: boolean;
    isNegotiating: boolean;
    pendingOffer: boolean;
  }> = new Map();

  private audioContextMap: Map<string, {
    context: AudioContext;
    analyser: AnalyserNode;
    dataArray: Uint8Array;
  }> = new Map();

  private constructor() {
    // 초기화 시점에 Promise 생성
    this.connectionPromise = new Promise((resolve) => {
      this.connectionResolve = resolve;
    });
  }

  static getInstance(): MediaServerConnection {
    if (!this.instance) {
      this.instance = new MediaServerConnection();
    }
    return this.instance;
  }

  setCallConnection(connection: CallConnection) {
    this.callConnection = connection;
    // CallConnection이 설정되면 Promise resolve
    if (this.connectionResolve) {
      this.connectionResolve();
    }
  }

  // WebRTC 관련 작업을 하는 모든 메서드에서 Connection 준비 상태 확인
  private async ensureCallConnection(): Promise<CallConnection> {
    if (!this.callConnection && this.connectionPromise) {
      await this.connectionPromise;
    }

    if (!this.callConnection) {
      throw new Error('CallConnection is not initialized');
    }

    return this.callConnection;
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

  async prepareConnection(channelId: string, remotePeerId: string, stream?: MediaStream) {
    // 현재 채널 상태 확인
    const currentChannel = useUserChannelStore.getState().currentUserChannel;
    if (!currentChannel.channelId || currentChannel.channelId !== channelId) {
      console.warn('Must join channel before establishing WebRTC connection');
      return;
    }

    // 채널의 유저 목록 확인
    const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId);
    if (!channelUsers?.some(user => user.userId === remotePeerId)) {
      console.warn('Remote peer is not in the channel');
      return;
    }

    await this.ensureCallConnection();
    const currentUserId = useAuthStore.getState().user?.user_id.toString();

    // 자기 자신과의 연결 시도 방지
    if (remotePeerId === currentUserId) {
      console.log('Preventing self-connection attempt');
      return;
    }

    // 이미 연결이 있는 경우 처리
    if (this.peerConnections.has(remotePeerId)) {
      console.log('Connection already exists, cleaning up first');
      await this.cleanupExistingConnection(remotePeerId);
    }

    console.log('Preparing connection for peer:', remotePeerId);

    // 초기 상태 설정
    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: true,
      isNegotiating: false,
      pendingOffer: false
    });

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
      sdpSemantics: 'unified-plan'
    });

    this.peerConnections.set(remotePeerId, peerConnection);

    // 스트림 추가
    if (stream) {
      console.log('Adding stream to peer connection:', {
        remotePeerId,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      this.localStream = stream;
    }

    // 이벤트 핸들러 설정
    await this.setupPeerConnectionHandlers(channelId, currentUserId, remotePeerId);

    // Offer 생성 및 전송
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      voiceActivityDetection: false
    };

    const connectionState = this.connectionStates.get(remotePeerId);
    if (!connectionState?.pendingOffer) {
      connectionState!.pendingOffer = true;
      try {
        const offer = await peerConnection.createOffer(offerOptions);
        console.log('Created offer:', {
          type: offer.type,
          remotePeerId,
          sdp: offer.sdp
        });

        await peerConnection.setLocalDescription(offer);

        this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
          sdp_offer: offer.sdp,
          sender_id: currentUserId,
        });
      } catch (error) {
        console.error('Error creating offer:', error);
        connectionState!.pendingOffer = false;
        throw error;
      }

      connectionState!.pendingOffer = false;
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
        console.log('Sending ICE candidate:', event.candidate);
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
      console.log('Track received:', {
        kind: event.track.kind,
        id: event.track.id,
        streams: event.streams.length
      });

      const track = event.track;
      const streams = event.streams;

      console.log('Track received detailed:', {
        kind: event.track.kind,
        id: event.track.id,
        readyState: event.track.readyState,
        enabled: event.track.enabled,
        muted: event.track.muted,
        streams: event.streams.map(stream => ({
          id: stream.id,
          active: stream.active,
          tracks: stream.getTracks().length
        }))
      });

      // 스트림 처리 전
      console.log('Processing stream before update:', {
        streamId: stream.id,
        active: stream.active,
        trackStates: stream.getTracks().map(track => ({
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled
        }))
      });

      // useUserChannelStore 업데이트 전
      console.log('Current store state before update:', {
        channelId,
        userId: streamData.userId,
        currentState: useUserChannelStore.getState().channelUsers.get(channelId)
      });

      if (!streams.length) {
        console.warn('No streams received with track');
        return;
      }

      const stream = streams[0];

      // 스트림 ID 검증 추가
      console.log('Stream details:', {
        id: stream.id,
        tracks: stream.getTracks().length,
        audio: stream.getAudioTracks().length,
        video: stream.getVideoTracks().length
      });

      // Kurento에서 오는 스트림 ID 파싱
      let streamData = this.parseKurentoStreamId(stream.id, remotePeerId);
      if (!streamData) {
        console.warn('Invalid stream ID format:', stream.id);
        streamData = {
          userId: remotePeerId,
          endpointId: 'default'
        };
      }

      // 상태 업데이트 전 스트림 유효성 확인
      if (stream.getTracks().length > 0) {
        useUserChannelStore.getState().updateUserMediaState(
          channelId,
          streamData.userId,
          { stream }
        );
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

      if (connectionState.pendingOffer) {
        console.log('Offer already pending, skipping negotiation');
        return;
      }

      try {
        connectionState.pendingOffer = true;
        await this.renegotiateConnection(remotePeerId);
      } finally {
        connectionState.pendingOffer = false;
      }
    };
  }

  async connectToAllUsers(channelId: string, stream?: MediaStream) {
    const users = useUserChannelStore.getState().channelUsers.get(channelId);
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    if (!currentUserId) return;

    // 자신을 제외한 다른 참가자들의 스트림을 받기 위한 연결만 생성
    for (const user of users || []) {
      if (user.userId !== currentUserId) {
        await this.prepareConnection(channelId, user.userId, stream);
      }
    }
  }

  async handleNewUser(channelId: string, newUserId: string) {
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId) || [];

    // 1. 자신이거나 채널에 혼자인 경우 WebRTC 연결 생성하지 않음
    if (newUserId === currentUserId || channelUsers.length <= 1) {
      return;
    }

    console.log('New user connecting:', {
      currentUserId,
      newUserId,
      existingConnection: this.peerConnections.has(newUserId)
    });

    // 2. 이미 연결이 있는 경우 중복 연결 시도하지 않음
    if (this.peerConnections.has(newUserId)) {
      console.log('Connection already exists for:', newUserId);
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

    if (!peerConnection || !connectionState || connectionState.isNegotiating) {
      console.log('Negotiation already in progress or no peer connection');
      return;
    }

    try {
      connectionState.isNegotiating = true;

      // 중요: 이전 연결 상태 확인 및 정리
      if (peerConnection.signalingState !== 'stable') {
        console.log('Connection not stable, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (peerConnection.signalingState !== 'stable') {
          console.log('Connection still not stable, rolling back');
          if (peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setLocalDescription({type: 'rollback'});
          }
        }
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: useAuthStore.getState().user?.user_id.toString(),
      });

      await new Promise(resolve => setTimeout(resolve, 500)); // 안정화를 위한 대기
    } catch (error) {
      console.error('Renegotiation failed:', error);
      await this.rollbackNegotiation(peerConnection);
    } finally {
      connectionState.isNegotiating = false;
    }
  }

  private async rollbackNegotiation(peerConnection: RTCPeerConnection) {
    try {
      if (peerConnection.signalingState !== 'stable') {
        await peerConnection.setLocalDescription({type: 'rollback'});
      }
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }

  private async createVideoOffer(remotePeerId: string) {
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) {
      console.error('No peer connection for:', remotePeerId);
      return;
    }

    try {
      // Kurento와의 호환성을 위한 SDP 제약 조건 추가
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      };

      const offer = await peerConnection.createOffer(offerOptions);

      // SDP 로깅 추가
      console.log('Created offer:', {
        sdp: offer.sdp,
        type: offer.type
      });

      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: useAuthStore.getState().user?.user_id.toString()
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  private resetConnectionState(remotePeerId: string) {
    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: false,
      isNegotiating: false,
      pendingOffer: false,
    });
    this.pendingCandidates.set(remotePeerId, []);
  }

  async handleRemoteAnswer(sdp: string, remotePeerId: string) {
    await this.ensureCallConnection();
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) {
      console.error('No peer connection found for:', remotePeerId);
      return;
    }

    try {
      // 시그널링 상태 및 연결 상태 로깅
      console.log('Handling remote answer:', {
        remotePeerId,
        signalingState: peerConnection.signalingState,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        sdp: sdp
      });

      if (peerConnection.signalingState === 'stable') {
        console.warn('Connection already stable, ignoring answer');
        return;
      }

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp
      });

      await peerConnection.setRemoteDescription(answer);
      console.log('Remote description set successfully for peer:', remotePeerId);

      // 대기 중인 ICE candidate 처리
      const candidates = this.pendingCandidates.get(remotePeerId) || [];
      for (const candidate of candidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added pending ICE candidate for peer:', remotePeerId);
        } catch (error) {
          console.error('Error adding pending ICE candidate:', error);
        }
      }
      this.pendingCandidates.set(remotePeerId, []);

    } catch (error) {
      console.error('Error handling remote answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit, remotePeerId: string) {
    await this.ensureCallConnection();
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection || !connectionState?.isConnecting) {
      console.log('No peer connection or not connecting for peer:', remotePeerId);
      return;
    }

    try {
      console.log('Handling ICE candidate:', {
        remotePeerId,
        candidate,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        signalingState: peerConnection.signalingState
      });

      if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Added ICE candidate for:', remotePeerId);
      } else {
        console.log('Queuing ICE candidate for:', remotePeerId);
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
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.localStream = newStream;

    const negotiationPromises = [];

    for (const [remotePeerId, peerConnection] of this.peerConnections) {
      // 현재 협상 상태 확인
      const connectionState = this.connectionStates.get(remotePeerId);
      if (connectionState?.isNegotiating) {
        await new Promise(resolve => {
          const checkState = setInterval(() => {
            if (!this.connectionStates.get(remotePeerId)?.isNegotiating) {
              clearInterval(checkState);
              resolve(true);
            }
          }, 100);
        });
      }

      // 트랙 추가
      const senders = peerConnection.getSenders();
      newStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          console.log('Adding track:', track.kind);
          peerConnection.addTrack(track, newStream);
        }
      });

      // 협상을 큐에 추가
      negotiationPromises.push(this.renegotiateConnection(remotePeerId));
    }

    // 모든 협상이 완료될 때까지 대기
    await Promise.all(negotiationPromises);

    // 오디오 감지 설정
    if (newStream.getAudioTracks().length > 0) {
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