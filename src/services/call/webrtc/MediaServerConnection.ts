import { useUserChannelStore } from '@/stores/userChannelStore';
import { CallConnection } from '../socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { ICE_SERVER_CONFIG, OP_CODES } from '@/services/call/constants';

export const OFFER_OPTION = {
  VOICE_CHANNEL: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
    voiceActivityDetection: true,
    iceRestart: true,
  },
  VIDEO_CHANNEL: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
    voiceActivityDetection: true,
    iceRestart: true,
  }
} as const;

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
  private readonly connectionPromise: Promise<void>;
  private connectionResolve!: () => void;
  private connectionInitialized: boolean = false;

  private connectionStates: Map<string, {
    isRemoteDescriptionSet: boolean;
    isConnecting: boolean;
    isNegotiating: boolean;
    pendingOffer: boolean;
    isInitiator: boolean;
    isGatheringComplete: boolean;
  }> = new Map();

  private audioContextMap: Map<string, {
    context: AudioContext;
    analyser: AnalyserNode;
    dataArray: Uint8Array;
  }> = new Map();

  private constructor() {
    this.connectionPromise = new Promise((resolve) => {
      this.connectionResolve = resolve;
    });
  }

  setCallConnection(connection: CallConnection) {
    this.callConnection = connection;
    this.connectionInitialized = true;
    this.connectionResolve();
  }

  private async ensureCallConnection(): Promise<CallConnection> {
    if (!this.connectionInitialized) {
      console.log('Waiting for CallConnection initialization...');
      await this.connectionPromise;
    }

    if (!this.callConnection) {
      throw new Error('CallConnection is not initialized even after waiting');
    }

    return this.callConnection;
  }

  static getInstance(): MediaServerConnection {
    if (!this.instance) {
      this.instance = new MediaServerConnection();
    }
    return this.instance;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private parseKurentoStreamId(streamId: string, remotePeerId?: string): { userId: string; endpointId: string } | null {
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

    if (this.peerConnections.has(remotePeerId)) {
      console.log('Connection already exists, cleaning up first');
      await this.cleanupExistingConnection(remotePeerId);
    }

    console.log('Preparing connection for peer:', remotePeerId);

    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: true,
      isNegotiating: false,
      pendingOffer: false,
      isInitiator: true,
      isGatheringComplete: false,
    });

    const peerConnection = new RTCPeerConnection(ICE_SERVER_CONFIG);
    console.log('NEW RTCPeerConnection', peerConnection);
    this.peerConnections.set(remotePeerId, peerConnection);

    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', {
        remotePeerId,
        state: peerConnection.iceGatheringState,
        connectionState: peerConnection.connectionState,
      });
    };

    if (stream) {
      this.localStream = stream;
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    }

    this.setupConnectionStateHandler(peerConnection, remotePeerId, channelId);
    this.setupIceHandler(peerConnection, remotePeerId, channelId);

    if (currentUserId !== remotePeerId) {
      this.setupTrackHandler(peerConnection, remotePeerId, channelId);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const connectionState = this.connectionStates.get(remotePeerId);
    const remotePeerUser = channelUsers?.find(user => user.userId === remotePeerId);

    if (!connectionState?.pendingOffer) {
      connectionState!.pendingOffer = true;
      try {
        const offerOptions = currentChannel.channelType === 'VOICE'
          ? OFFER_OPTION.VOICE_CHANNEL
          : OFFER_OPTION.VIDEO_CHANNEL;

        const offer = await peerConnection.createOffer(offerOptions);
        console.log('Created offer SDP:', {
          remotePeerId,
          hasAudio: offer.sdp.includes('m=audio'),
          hasVideo: offer.sdp.includes('m=video'),
          videoSection: offer.sdp.split('m=video')[1]?.split('m=')[0],
        });

        await peerConnection.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
              resolve();
            }
          };
        });

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

  private setupConnectionStateHandler(peerConnection: RTCPeerConnection, remotePeerId: string, channelId: string) {
    let isReconnecting = false;
    let reconnectionTimer: NodeJS.Timeout | null = null;

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('Connection state changed:', {
        peerId: remotePeerId,
        state: peerConnection.connectionState,
        iceState: peerConnection.iceConnectionState,
        signalingState: peerConnection.signalingState,
      });

      const connectionState = this.connectionStates.get(remotePeerId);
      if (!connectionState) return;

      switch (state) {
        case 'connected':
          console.log('Peer connection established:', {
            remotePeerId,
            timestamp: new Date().toISOString(),
            connectionDetails: {
              state: peerConnection.connectionState,
              iceState: peerConnection.iceConnectionState,
              signalingState: peerConnection.signalingState,
            },
            mediaState: {
              receivers: peerConnection.getReceivers().map(receiver => ({
                kind: receiver.track.kind,
                enabled: receiver.track.enabled,
                muted: receiver.track.muted,
              })),
            },
          });
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

          isReconnecting = true;
          console.warn(`Connection issue with ${remotePeerId} (attempt ${attempts + 1}/${this.MAX_RECONNECTION_ATTEMPTS})`);

          reconnectionTimer = setTimeout(async () => {
            try {
              await this.attemptReconnection(remotePeerId, channelId);
            } finally {
              isReconnecting = false;
              reconnectionTimer = null;
            }
          }, this.ICE_RECONNECTION_TIMEOUT);
          break;

        case 'closed':
          console.log(`Connection closed for ${remotePeerId}`);
          if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            reconnectionTimer = null;
          }
          isReconnecting = false;
          this.resetConnectionState(remotePeerId);
          break;
      }
    };
  }

  async createLocalPeer(channelId: string, userId: string, stream: MediaStream) {
    const callConnection = await this.ensureCallConnection();
    const peerConnection = new RTCPeerConnection(ICE_SERVER_CONFIG);
    this.localStream = stream;

    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    console.log('SEND ICE CANDIDATE : LOCAL PEER ->', userId, useAuthStore.getState().user?.user_id);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callConnection.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate?.sdpMid,
          sdp_m_line_index: event.candidate?.sdpMLineIndex,
          target_id: userId,
        });
      }
    };

    this.setupConnectionStateHandler(peerConnection, userId, channelId);

    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      console.log('SEND RECEIVED VIDEO : LOCAL PEER ->', userId, useAuthStore.getState().user?.user_id);
      callConnection.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: userId,
      });

      this.peerConnections.set(userId, peerConnection);
    } catch (error) {
      console.error('Error creating local peer:', error);
      throw error;
    }
  }

  async createRemotePeer(channelId: string, remoteUserId: string) {
    const peerConnection = new RTCPeerConnection(ICE_SERVER_CONFIG);

    peerConnection.ontrack = (event) => {
      if (!event.streams.length) return;

      const stream = event.streams[0];
      this.setupRemoteAudioDetection(stream, remoteUserId);

      useUserChannelStore.getState().updateUserMediaState(
        channelId,
        remoteUserId,
        { stream },
      );
    };

    console.log('SEND ICE CANDIDATE : REMOTE PEER ->', remoteUserId);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate?.sdpMid,
          sdp_m_line_index: event.candidate?.sdpMLineIndex,
          target_id: remoteUserId,
        });
      }
    };

    this.setupConnectionStateHandler(peerConnection, remoteUserId, channelId);

    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      console.log('SEND RECEIVED VIDEO : REMOTE PEER ->', remoteUserId);
      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remoteUserId,
      });

      this.peerConnections.set(remoteUserId, peerConnection);
    } catch (error) {
      console.error('Error creating remote peer:', error);
      throw error;
    }
  }

  private setupTrackHandler(peerConnection: RTCPeerConnection, remotePeerId: string, channelId: string) {
    peerConnection.ontrack = (event) => {
      console.log('Media track added:', {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        muted: event.track.muted,
        streamDetails: {
          id: event.streams[0]?.id,
          trackCount: event.streams[0]?.getTracks().length,
        },
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
        streamTracks: stream.getTracks().length,
      });

      let streamData = this.parseKurentoStreamId(stream.id, remotePeerId);
      if (!streamData) {
        streamData = {
          userId: remotePeerId,
          endpointId: 'default',
        };
      }

      const currentUser = useUserChannelStore
        .getState()
        .channelUsers.get(channelId)
        ?.find(user => user.userId === streamData.userId);

      console.log('Received track:', {
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
        constraints: track.getConstraints(),
        settings: track.getSettings(),
      });

      let updatedStream: MediaStream;
      if (currentUser?.mediaState.stream) {
        const activeTracks = currentUser.mediaState.stream.getTracks().filter(t =>
          t.readyState === 'live' && !t.muted,
        );

        updatedStream = new MediaStream();

        activeTracks.forEach(t => updatedStream.addTrack(t));

        if (track.readyState === 'live') {
          updatedStream.addTrack(track);
        }

      } else {
        updatedStream = new MediaStream([track]);
      }

      console.log('Final stream state:', {
        videoTracks: updatedStream.getVideoTracks().length,
        audioTracks: updatedStream.getAudioTracks().length,
        allTracks: updatedStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      });

      if (track.kind === 'audio' && track.enabled) {
        this.setupRemoteAudioDetection(updatedStream, streamData.userId);
      }

      if (stream.id.includes('screenshare') && track.kind === 'video') {
        useUserChannelStore.getState().updateUserMediaState(
          channelId,
          streamData.userId,
          {
            isScreenSharing: true,
            screenStream: stream,
          },
        );
        return;
      }

      useUserChannelStore.getState().updateUserMediaState(
        channelId,
        streamData.userId,
        {
          stream: updatedStream,
          isCameraOn: updatedStream.getVideoTracks().length > 0 &&
            updatedStream.getVideoTracks()[0].enabled,
        },
      );

      track.onended = () => {
        this.handleTrackEnded(track, updatedStream, channelId, streamData.userId);
      };

      console.log('Track handler completed:', {
        userId: streamData.userId,
        finalTrackCount: updatedStream.getTracks().length,
        hasVideo: updatedStream.getVideoTracks().length > 0,
        hasAudio: updatedStream.getAudioTracks().length > 0,
      });
    };
  }

  private setupIceHandler(peerConnection: RTCPeerConnection, remotePeerId: string, channelId: string) {
    let iceCandidateQueue: RTCIceCandidate[] = [];
    let isGatheringComplete = false;

    peerConnection.onicecandidate = (event) => {
      if (!peerConnection.localDescription) {
        console.warn('No local description set, queuing ICE candidate');
        if (event.candidate) {
          iceCandidateQueue.push(event.candidate);
        }
        return;
      }

      if (event.candidate) {
        console.log('ICE candidate generated:', {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
        });

        this.callConnection?.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate.sdpMid,
          sdp_m_line_index: event.candidate.sdpMLineIndex,
          target_id: remotePeerId,
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log('ICE connection state changed:', {
        peerId: remotePeerId,
        state: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState,
        signalingState: peerConnection.signalingState,
      });

      switch (state) {
        case 'checking':
          console.log(`ICE checking in progress for ${remotePeerId}`);
          break;
        case 'connected':
          console.log(`ICE Connection established with ${remotePeerId}`);
          if (iceCandidateQueue.length > 0) {
            this.processQueuedCandidates(peerConnection, iceCandidateQueue);
          }
          break;
        case 'failed':
          console.warn(`ICE connection failed for ${remotePeerId}`);
          if (peerConnection.connectionState !== 'failed') {
            this.handleIceFailure(peerConnection, remotePeerId, channelId);
          }
          break;
        case 'disconnected':
          console.warn(`ICE connection disconnected for ${remotePeerId}`);
          this.handleIceDisconnection(peerConnection, remotePeerId, channelId);
          break;
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      const state = peerConnection.iceGatheringState;
      console.log('ICE gathering state changed:', {
        remotePeerId,
        state: state,
        connectionState: peerConnection.connectionState,
        signalingState: peerConnection.signalingState,
      });

      if (state === 'complete') {
        isGatheringComplete = true;
        console.log('ICE gathering completed for:', remotePeerId);
        this.handleIceGatheringComplete(peerConnection, remotePeerId);
      }
    };
  }

  private async processQueuedCandidates(peerConnection: RTCPeerConnection, candidates: RTCIceCandidate[]) {
    console.log(`Processing ${candidates.length} queued ICE candidates`);

    for (const candidate of candidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log('Successfully added queued ICE candidate:', {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address,
          port: candidate.port
        });
      } catch (error) {
        console.error('Error adding queued ICE candidate:', error);
      }
    }
    candidates.length = 0;
  }

  private async handleIceFailure(peerConnection: RTCPeerConnection, remotePeerId: string, channelId: string) {
    console.log('Attempting ICE restart...');
    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId,
      });
    } catch (error) {
      console.error('ICE restart failed:', error);
      this.attemptReconnection(remotePeerId, channelId);
    }
  }

  private handleIceDisconnection(peerConnection: RTCPeerConnection, remotePeerId: string, channelId: string) {
    if (peerConnection.connectionState === 'connected') {
      setTimeout(() => {
        if (peerConnection.iceConnectionState === 'disconnected') {
          this.attemptReconnection(remotePeerId, channelId);
        }
      }, this.ICE_RECONNECTION_TIMEOUT);
    }
  }

  private handleIceGatheringComplete(peerConnection: RTCPeerConnection, remotePeerId: string) {
    const connectionState = this.connectionStates.get(remotePeerId);
    if (connectionState) {
      connectionState.isGatheringComplete = true;
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

    if (newUserId === currentUserId) {
      console.log('Skip self connection');
      return;
    }

    if (this.peerConnections.has(newUserId)) {
      const connection = this.peerConnections.get(newUserId);
      const state = connection?.connectionState;
      console.log(`Existing connection state for ${newUserId}:`, state);

      if (state === 'connected') {
        return;
      }
      await this.cleanupExistingConnection(newUserId);
    }

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
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);

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
    if (!peerConnection) return;

    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId,
      });
    } catch (error) {
      console.error('Renegotiation failed:', error);
      throw error;
    }
  }

  private resetConnectionState(remotePeerId: string) {
    this.connectionStates.set(remotePeerId, {
      isRemoteDescriptionSet: false,
      isConnecting: false,
      isNegotiating: false,
      pendingOffer: false,
      isInitiator: false,
      isGatheringComplete: false,
    });
    this.pendingCandidates.set(remotePeerId, []);
  }

  async handleRemoteAnswer(sdp: string, remotePeerId: string) {
    console.log('Received answer SDP:', {
      remotePeerId,
      hasAudio: sdp.includes('m=audio'),
      hasVideo: sdp.includes('m=video'),
      videoSection: sdp.split('m=video')[1]?.split('m=')[0]
    });

    await this.ensureCallConnection();
    const peerConnection = this.peerConnections.get(remotePeerId);
    const connectionState = this.connectionStates.get(remotePeerId);

    if (!peerConnection) {
      console.error('No peer connection found for:', remotePeerId);
      return;
    }

    try {
      if (peerConnection.signalingState !== 'have-local-offer') {
        console.warn('Unexpected signaling state for answer:', peerConnection.signalingState);

        if (peerConnection.signalingState === 'stable') {
          console.log('Connection is stable, creating new offer...');
          const offer = await peerConnection.createOffer({
            iceRestart: true
          });
          await peerConnection.setLocalDescription(offer);
          return;
        }

        if (peerConnection.signalingState === 'have-remote-offer') {
          await peerConnection.setLocalDescription({type: 'rollback'});
        }
      }

      console.log('Handling remote answer:', {
        remotePeerId,
        signalingState: peerConnection.signalingState,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
      });

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp
      });

      await peerConnection.setRemoteDescription(answer);
      console.log('Remote description set successfully for peer:', remotePeerId);

      if (connectionState) {
        connectionState.isRemoteDescriptionSet = true;
      }

      const candidates = this.pendingCandidates.get(remotePeerId) || [];
      console.log(`Processing ${candidates.length} pending ICE candidates for:`, remotePeerId);

      for (const candidate of candidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Successfully added pending ICE candidate');
        } catch (error) {
          console.error('Error adding pending ICE candidate:', error);
        }
      }
      this.pendingCandidates.set(remotePeerId, []);

      if (peerConnection.iceConnectionState === 'failed') {
        console.warn('ICE connection failed after setting remote description');
        await this.restartIce(peerConnection, remotePeerId);
      }

    } catch (error) {
      console.error('Error handling remote answer:', error);
      if (error instanceof Error && error.name === 'InvalidStateError') {
        await this.handleInvalidStateError(peerConnection, remotePeerId);
      } else {
        throw error;
      }
    }
  }

  private async restartIce(peerConnection: RTCPeerConnection, remotePeerId: string) {
    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId
      });
    } catch (error) {
      console.error('ICE restart failed:', error);
    }
  }

  private async handleInvalidStateError(peerConnection: RTCPeerConnection, remotePeerId: string) {
    try {
      await peerConnection.setLocalDescription({type: 'rollback'});
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      const offerOptions = currentChannel.channelType === 'VOICE'
        ? OFFER_OPTION.VOICE_CHANNEL
        : OFFER_OPTION.VIDEO_CHANNEL;

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      this.callConnection?.sendOp(OP_CODES.RECEIVE_VIDEO, {
        sdp_offer: offer.sdp,
        sender_id: remotePeerId
      });
    } catch (error) {
      console.error('Error recovery failed:', error);
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

      if (connectionState.isRemoteDescriptionSet) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => console.log('ICE Candidate added successfully'))
          .catch(console.error);
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
      await this.cleanupExistingConnection(remotePeerId);
      await new Promise(resolve => setTimeout(resolve, 2000));

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

  setupLocalAudioDetection(stream: MediaStream) {
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

    const currentUserId = useAuthStore.getState().user?.user_id.toString();
    if (!currentUserId) return;

    const peerConnection = this.peerConnections.get(currentUserId);
    if (!peerConnection) return;

    newStream.getTracks().forEach(track => {
      const sender = peerConnection.getSenders().find(s => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track);
      } else {
        peerConnection.addTrack(track, newStream);
      }
    });

    if (peerConnection.connectionState === 'connected') {
      await this.renegotiateConnection(currentUserId);
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

        const params = videoSender?.getParameters();
        if (params && !params.encodings) {
          params.encodings = [{}];
          params.encodings[0].maxBitrate = 3000000;
          params.encodings[0].maxFramerate = 30;
          await videoSender.setParameters(params);
        }
      }

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
          videoSender.track.stop();
          await videoSender.replaceTrack(null);
        }
      }

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

    this.peerConnections.forEach((connection, peerId) => {
      connection.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });

      connection.close();

      this.resetConnectionState(peerId);
    });

    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.reconnectionAttempts.clear();
  }

  dispose() {
    this.disconnect();
    this.callConnection = null;
    MediaServerConnection.instance = null;
  }
}