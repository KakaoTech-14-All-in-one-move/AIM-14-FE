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
    isInitiator: boolean
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
    console.log('ensureCallConnection');
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
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    console.log('Prepare Connection', currentUserId, channelId, remotePeerId, stream);
    const currentChannel = useUserChannelStore.getState().currentUserChannel;
    if (!currentChannel.channelId || currentChannel.channelId !== channelId) {
      console.warn('Must join channel before establishing WebRTC connection');
      return;
    }

    const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId);
    if (!channelUsers?.some(user => user.userId === remotePeerId)) {
      console.warn('Remote peer is not in the channel');
      return;
    }

    await this.ensureCallConnection();

    if (remotePeerId === currentUserId) {
      console.log('Creating publisher connection for self');
    }

    // 기존 연결 정리
    if (this.peerConnections.has(remotePeerId)) {
      console.log('Connection already exists, cleaning up first');
      await this.cleanupExistingConnection(remotePeerId);
    }

    console.log('Preparing connection for peer:', remotePeerId);

    // 새로운 상태 관리 구조
    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: true,
      isNegotiating: false,
      pendingOffer: false,
      isInitiator: true,
    });

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
      sdpSemantics: 'unified-plan',
    });

    console.log('NEW RTCPeerConnection', peerConnection);
    this.peerConnections.set(remotePeerId, peerConnection);

    if (stream) {
      this.localStream = stream;
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    }

    if (currentUserId !== remotePeerId) {
      await this.setupPeerConnectionHandlers(channelId, currentUserId!, remotePeerId);
    }

    // Offer 생성 및 전송
    const connectionState = this.connectionStates.get(remotePeerId);
    if (!connectionState?.pendingOffer) {
      connectionState!.pendingOffer = true;
      try {
        const offerOptions = {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: false,
        };

        const offer = await peerConnection.createOffer(offerOptions);
        console.log('Created offer:', {
          type: offer.type,
          remotePeerId,
          sdp: offer.sdp,
        });

        await peerConnection.setLocalDescription(offer);

        console.log('OP_CODES.RECEIVE_VIDEO - prepareConnection');
        this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
          sdp_offer: offer.sdp,
          sender_id: remotePeerId,
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

    // 연결 상태 관리를 위한 새로운 변수 추가
    let isReconnecting = false;
    let reconnectionTimer: NodeJS.Timeout | null = null;

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state for ${remotePeerId}: ${state}`);

      // 현재 연결 상태 가져오기
      const connectionState = this.connectionStates.get(remotePeerId);
      if (!connectionState) return;

      switch (state) {
        case 'connected':
          console.log(`Successfully connected to peer ${remotePeerId}`);
          // 재연결 관련 상태 초기화
          isReconnecting = false;
          if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            reconnectionTimer = null;
          }
          connectionState.isConnecting = false;
          this.reconnectionAttempts.set(remotePeerId, 0);
          break;

        case 'failed':
        case 'disconnected':
          // 이미 재연결 시도 중이면 추가 시도 방지
          if (isReconnecting) {
            console.log('Reconnection already in progress, skipping additional attempt');
            return;
          }

          const attempts = this.reconnectionAttempts.get(remotePeerId) || 0;
          if (attempts >= this.MAX_RECONNECTION_ATTEMPTS) {
            console.error(`Max reconnection attempts reached for ${remotePeerId}`);
            this.cleanupExistingConnection(remotePeerId);
            return;
          }

          // 재연결 시도 전 상태 업데이트
          isReconnecting = true;
          console.warn(`Connection issue with ${remotePeerId} (attempt ${attempts + 1}/${this.MAX_RECONNECTION_ATTEMPTS})`);

          // 재연결 시도 전 짧은 지연 시간 추가
          reconnectionTimer = setTimeout(async () => {
            try {
              await this.attemptReconnection(remotePeerId, channelId);
            } finally {
              // 재연결 시도 완료 후 상태 업데이트
              isReconnecting = false;
              reconnectionTimer = null;
            }
          }, this.ICE_RECONNECTION_TIMEOUT);
          break;

        case 'closed':
          console.log(`Connection closed for ${remotePeerId}`);
          // 재연결 관련 상태 정리
          if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            reconnectionTimer = null;
          }
          isReconnecting = false;
          this.resetConnectionState(remotePeerId);
          break;
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Track received:', {
        kind: event.track.kind,
        id: event.track.id,
        streams: event.streams.length,
      });

      if (!event.streams.length) {
        console.warn('No streams received with track');
        return;
      }

      const track = event.track;
      const stream = event.streams[0];

      console.log('Track received detailed:', {
        kind: track.kind,
        id: track.id,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
        streamId: stream.id,
        streamActive: stream.active,
        streamTracks: stream.getTracks().length,
      });

      // Kurento에서 오는 스트림 ID 파싱
      let streamData = this.parseKurentoStreamId(stream.id, remotePeerId);
      if (!streamData) {
        console.warn('Invalid stream ID format:', stream.id);
        streamData = {
          userId: remotePeerId,
          endpointId: 'default',
        };
      }

      // 현재 채널 상태 확인
      const currentChannelUsers = useUserChannelStore.getState().channelUsers.get(channelId);
      const currentUser = currentChannelUsers?.find(user => user.userId === streamData.userId);

      console.log('Stream state before update:', {
        channelId,
        userId: streamData.userId,
        streamId: stream.id,
        trackKind: track.kind,
        hasExistingStream: !!currentUser?.mediaState.stream,
        trackCount: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // 스트림 유효성 확인 및 업데이트
      if (stream.getTracks().length > 0) {
        // 오디오 감지 설정 (오디오 트랙이 있는 경우)
        if (track.kind === 'audio' && stream.getAudioTracks().length > 0) {
          this.setupRemoteAudioDetection(stream, streamData.userId);
        }

        // 기존 스트림이 있다면 새 트랙 추가 전에 같은 종류의 트랙이 있는지 확인
        if (currentUser?.mediaState.stream) {
          try {
            const existingStream = currentUser.mediaState.stream;
            const existingTrackOfSameKind = existingStream.getTracks().find(t => t.kind === track.kind);

            if (!existingTrackOfSameKind) {
              existingStream.addTrack(track);
              console.log('Added track to existing stream:', {
                streamId: existingStream.id,
                trackKind: track.kind,
                totalTracks: existingStream.getTracks().length,
              });
            } else {
              console.log('Track of same kind already exists, skipping:', track.kind);
            }
          } catch (error) {
            console.error('Error adding track to existing stream:', error);
            useUserChannelStore.getState().updateUserMediaState(
              channelId,
              streamData.userId,
              { stream },
            );
          }
        }

        // 트랙 종료 이벤트 핸들러 설정
        track.onended = () => {
          this.handleTrackEnded(track, stream, channelId, streamData.userId);
        };

        // 스크린쉐어 스트림인 경우 별도 처리
        if (stream.id.includes('screenshare')) {
          useUserChannelStore.getState().updateUserMediaState(
            channelId,
            streamData.userId,
            {
              isScreenSharing: true,
              screenStream: stream,
            },
          );
        }
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

    // peerConnection.onnegotiationneeded = async () => {
    //   const connectionState = this.connectionStates.get(remotePeerId);
    //   if (!connectionState) {
    //     console.error('No connection state found for:', remotePeerId);
    //     return;
    //   }
    //
    //   if (connectionState.pendingOffer) {
    //     console.log('Offer already pending, skipping negotiation');
    //     return;
    //   }
    //
    //   try {
    //     connectionState.pendingOffer = true;
    //     await this.renegotiateConnection(remotePeerId);
    //   } finally {
    //     connectionState.pendingOffer = false;
    //   }
    // };
  }

  async connectToAllUsers(channelId: string, stream?: MediaStream) {
    console.log('Connect To All Users', channelId, stream);
    const users = useUserChannelStore.getState().channelUsers.get(channelId);
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    console.log('currentUserId | users', currentUserId, users);
    if (!currentUserId || !users) return;

    for (const user of users) {
      await this.prepareConnection(channelId, user.userId, stream);
    }
  }

  async handleNewUser(channelId: string, newUserId: string) {
    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId) || [];

    console.log('Handle new user:', {
      currentUserId,
      newUserId,
      channelUsers: channelUsers.map(u => u.userId),
      hasLocalStream: !!this.localStream,
      connectionCount: this.peerConnections.size,
    });

    // 1. 자신인 경우 처리
    if (newUserId === currentUserId) {
      console.log('Skip self connection');
      return;
    }

    // 2. 기존 연결 확인 및 정리
    if (this.peerConnections.has(newUserId)) {
      const connection = this.peerConnections.get(newUserId);
      const state = connection?.connectionState;
      console.log(`Existing connection state for ${newUserId}:`, state);

      if (state === 'connected') {
        return;
      }
      await this.cleanupExistingConnection(newUserId);
    }

    // 3. 새로운 연결 시도 - 각 사용자는 자신의 스트림을 서버로 보내기 위한 연결만 생성
    try {
      if (this.localStream) {
        console.log('Local stream details:', {
          audioTracks: this.localStream.getAudioTracks().length,
          videoTracks: this.localStream.getVideoTracks().length,
        });
      }

      await this.prepareConnection(channelId, newUserId, this.localStream || undefined);
    } catch (error) {
      console.error('Failed to establish connection with new user:', error);
      // 실패 시 재시도
      setTimeout(() => {
        this.handleNewUser(channelId, newUserId);
      }, 2000);
    }
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

  private async rollbackNegotiation(peerConnection: RTCPeerConnection) {
    try {
      if (peerConnection.signalingState !== 'stable') {
        await peerConnection.setLocalDescription({ type: 'rollback' });
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
        voiceActivityDetection: true,
      };

      const offer = await peerConnection.createOffer(offerOptions);

      // SDP 로깅 추가
      console.log('Created offer:', {
        sdp: offer.sdp,
        type: offer.type,
      });

      await peerConnection.setLocalDescription(offer);

      console.log('OP_CODES.RECEIVE_VIDEO - createVideoOffer');
      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
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
            await peerConnection.setLocalDescription({ type: 'rollback' });
          }
        }
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      console.log('OP_CODES.RECEIVE_VIDEO- renegotiateConnection', remotePeerId);
      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId,
      });

      await new Promise(resolve => setTimeout(resolve, 500)); // 안정화를 위한 대기
    } catch (error) {
      console.error('Renegotiation failed:', error);
      await this.rollbackNegotiation(peerConnection);
    } finally {
      connectionState.isNegotiating = false;
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
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection) {
      console.error('No peer connection found for:', remotePeerId);
      return;
    }

    try {
      console.log('Handling remote answer:', {
        remotePeerId,
        signalingState: peerConnection.signalingState,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        sdp: sdp,
      });

      // 시그널링 상태 검증
      if (peerConnection.signalingState !== 'have-local-offer') {
        console.warn('Unexpected signaling state for answer:', peerConnection.signalingState);
        return;
      }

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp,
      });

      await peerConnection.setRemoteDescription(answer);
      if (connectionState) {
        connectionState.isRemoteDescriptionSet = true;
      }
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
        signalingState: peerConnection.signalingState,
      });

      // remoteDescription이 설정된 후에만 ICE candidate 추가
      if (connectionState.isRemoteDescriptionSet) {
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

  private async attemptReconnection(remotePeerId: string, channelId: string) {
    const attempts = this.reconnectionAttempts.get(remotePeerId) || 0;
    if (attempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      console.error(`Max reconnection attempts reached for ${remotePeerId}`);
      return;
    }

    console.log(`Attempting reconnection to ${remotePeerId} (attempt ${attempts + 1})`);
    this.reconnectionAttempts.set(remotePeerId, attempts + 1);

    try {
      // 기존 연결 정리를 확실히
      await this.cleanupExistingConnection(remotePeerId);

      // 충분한 대기 시간 추가
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 연결 상태 확인
      const existingConnection = this.peerConnections.get(remotePeerId);
      if (existingConnection) {
        console.log('Existing connection found, skipping reconnection');
        return;
      }

      await this.prepareConnection(channelId, remotePeerId, this.localStream || undefined);
    } catch (error) {
      console.error('Reconnection failed:', error);
      setTimeout(() => {
        this.attemptReconnection(remotePeerId, channelId);
      }, this.ICE_RECONNECTION_TIMEOUT);
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

    // 단순히 각 sender의 트랙만 교체
    for (const [_, peerConnection] of this.peerConnections) {
      const senders = peerConnection.getSenders();
      newStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        }
      });
    }

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

      for (const [_, peerConnection] of this.peerConnections) {
        const senders = peerConnection.getSenders();
        const videoTrack = screenStream.getVideoTracks()[0];
        const videoSender = senders.find(sender =>
          sender.track?.kind === 'video',
        );

        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        } else {
          peerConnection.addTrack(videoTrack, screenStream);
        }

        // 품질 최적화 설정
        const params = videoSender?.getParameters();
        if (params && !params.encodings) {
          params.encodings = [{}];
          params.encodings[0].maxBitrate = 3000000;
          params.encodings[0].maxFramerate = 30;
          await videoSender.setParameters(params);
        }
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
      for (const [_, peerConnection] of this.peerConnections) {
        const senders = peerConnection.getSenders();
        const videoSender = senders.find(sender =>
          sender.track?.kind === 'video',
        );

        if (videoSender && videoSender.track) {
          videoSender.track.stop();  // 기존 스크린쉐어 트랙 정지
          await videoSender.replaceTrack(null);  // 비디오 트랙 제거
        }
      }

      // 오디오 트랙은 그대로 유지
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        const newStream = new MediaStream();
        audioTracks.forEach(track => newStream.addTrack(track));
        this.localStream = newStream;
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

    // 연결 관련 상태만 정리
    this.peerConnections.clear();
    this.connectionStates.clear();
    this.pendingCandidates.clear();
    this.reconnectionAttempts.clear();

    // callConnection은 유지
  }

  // dispose는 앱이 완전히 종료될 때만 호출되어야 함
  dispose() {
    this.disconnect();
    this.callConnection = null;
    MediaServerConnection.instance = null;
  }
}