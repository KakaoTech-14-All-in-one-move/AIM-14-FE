import { MediaType } from '@/services/call/types';
import { VoiceStateUpdate } from '@/services/call/socket/types';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { useUserStore } from '@/stores/userStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useMediaChatStore } from '@/stores/useMediaChatStore';
import { CallConnection } from '@/services/call/socket/callConnection';
import { useAuthStore } from '@/stores/authStore.ts';

interface MediaConnectionState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  currentChannelId: string | null;
  currentChannelType: MediaType | null;
  lastError: Error | null;
}

export class MediaConnectionManager {
  private static instance: MediaConnectionManager | null = null;
  private webrtc: WebRTCConnection;
  private callConnection: CallConnection | null = null;
  private state: MediaConnectionState;
  private stateUpdateCallbacks: Set<(state: MediaConnectionState) => void>;

  private constructor() {
    this.webrtc = WebRTCConnection.getInstance();
    this.state = {
      connectionStatus: 'disconnected',
      currentChannelId: null,
      currentChannelType: null,
      lastError: null,
    };
    this.stateUpdateCallbacks = new Set();
  }

  static getInstance(): MediaConnectionManager {
    if (!this.instance) {
      this.instance = new MediaConnectionManager();
    }
    return this.instance;
  }

  // 상태 관리 메서드
  private setState(newState: Partial<MediaConnectionState>) {
    this.state = { ...this.state, ...newState };
    this.notifyStateUpdate();
  }

  private notifyStateUpdate() {
    this.stateUpdateCallbacks.forEach(callback => callback(this.state));
  }

  onStateUpdate(callback: (state: MediaConnectionState) => void) {
    this.stateUpdateCallbacks.add(callback);
    return () => this.stateUpdateCallbacks.delete(callback);
  }

  setCallConnection(connection: CallConnection) {
    this.callConnection = connection;
  }

  // 채널 입장 핵심 로직
  async joinChannel(channelId: string, type: MediaType): Promise<boolean> {
    if (!this.callConnection) {
      this.setError(new Error('No call connection available'));
      return false;
    }

    try {
      this.setState({ connectionStatus: 'connecting' });

      // 1. 채널 입장 요청
      const success = await this.callConnection.joinChannel(channelId, type);
      if (!success) {
        throw new Error('Failed to join channel');
      }

      // 2. 스토어 상태 업데이트
      await this.updateStores({
        channelId,
        channelType: type,
        userId: useAuthStore.getState().user?.email!
      });

      // 3. 미디어 초기화
      const mediaInitialized = await this.initializeMedia(type);
      if (!mediaInitialized) {
        throw new Error('Failed to initialize media');
      }

      this.setState({
        connectionStatus: 'connected',
        currentChannelId: channelId,
        currentChannelType: type,
        lastError: null,
      });

      return true;

    } catch (error) {
      await this.handleJoinError(error as Error);
      return false;
    }
  }

  // 채널 퇴장 로직
  async leaveChannel(): Promise<void> {
    try {
      const currentUserId = useUserStore.getState().currentUser?.user_id;
      if (!currentUserId || !this.state.currentChannelId) return;

      // 1. 서버에 퇴장 알림
      // this.callConnection?.leaveChannel();

      // 2. 미디어 정리
      await this.cleanupChannel(currentUserId);

      // 3. 상태 초기화
      this.setState({
        connectionStatus: 'disconnected',
        currentChannelId: null,
        currentChannelType: null,
      });

    } catch (error) {
      this.setError(error as Error);
      console.error('Error leaving channel:', error);
    }
  }

  // 스토어 상태 업데이트
  private async updateStores({ channelId, channelType, userId }: {
    channelId: string;
    channelType: MediaType;
    userId: string;
  }) {
    const stores = {
      user: useUserStore.getState(),
      media: useMediaStore.getState(),
      mediaChat: useMediaChatStore.getState(),
    };

    // MediaStore 업데이트
    stores.media.setChannelInfo(channelId, channelType);

    // MediaChatStore 업데이트
    stores.mediaChat.setCurrentUserId(userId);

    // 초기 상태 설정
    stores.mediaChat.updateUserState(userId, {
      muted: stores.media.isMuted,
      deafened: stores.media.isDeafened,
      cameraOn: !stores.media.isCameraOff,
      screenSharing: stores.media.isScreenSharing,
      speaking: false,
      stream: null,
      screenStream: null,
    });
  }

  // 미디어 초기화
  private async initializeMedia(channelType: MediaType): Promise<boolean> {
    try {
      const userId = useMediaChatStore.getState().currentUserId;
      if (!userId) {
        throw new Error('No user ID available');
      }

      const localStream = await this.webrtc.initializeLocalStream(channelType === 'VIDEO');
      if (!localStream) {
        throw new Error('Failed to initialize local stream');
      }

      // 스트림 설정
      useMediaChatStore.getState().setStream(userId, localStream);

      // 기존 사용자들과 연결 설정
      const users = useUserStore.getState().users;
      await Promise.all(users.map(async (user) => {
        if (user.user_id !== userId) {
          await this.webrtc.createPeerConnection(user.user_id);
        }
      }));

      return true;
    } catch (error) {
      console.error('Error initializing media:', error);
      return false;
    }
  }

  // 채널 정리
  private async cleanupChannel(userId: string) {
    // 1. 미디어 스트림 정리
    const userState = useMediaChatStore.getState().userStates.get(userId);
    console.log("CLEAN_UP_CHANNEL : ", userState); // TODO : NULL !!
    if (userState) {
      [userState.stream, userState.screenStream].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
    }

    // 2. WebRTC 연결 정리
    this.webrtc.closeAllConnections();

    // 3. 스토어 초기화
    useUserStore.getState().resetState();
    useMediaStore.getState().resetState();
    useMediaChatStore.getState().resetState();
  }

  // 미디어 상태 업데이트
  async updateMediaState(update: VoiceStateUpdate): Promise<boolean> {
    try {
      const userId = useMediaChatStore.getState().currentUserId;
      if (!userId) return false;

      const stores = {
        media: useMediaStore.getState(),
        mediaChat: useMediaChatStore.getState(),
      };

      // MediaStore 업데이트
      if ('muted' in update) stores.media.setMuted(update.muted ?? false);
      if ('deafened' in update) stores.media.setDeafened(update.deafened ?? false);
      if ('camera_on' in update) stores.media.setCameraOff(!update.camera_on);
      if ('screen_sharing' in update) stores.media.setScreenSharing(update.screen_sharing ?? false);

      // MediaChatStore 업데이트
      stores.mediaChat.updateUserState(userId, {
        muted: update.muted,
        deafened: update.deafened,
        cameraOn: update.camera_on,
        screenSharing: update.screen_sharing,
      });

      // 서버에 상태 업데이트 전송
      this.callConnection?.updateState(update);

      return true;
    } catch (error) {
      this.setError(error as Error);
      return false;
    }
  }

  // 에러 처리
  private async handleJoinError(error: Error) {
    console.error('Join channel error:', error);

    // 상태 초기화
    const userId = useMediaChatStore.getState().currentUserId;
    if (userId) {
      await this.cleanupChannel(userId);
    }

    this.setState({
      connectionStatus: 'error',
      lastError: error,
    });
  }

  private setError(error: Error) {
    this.setState({ lastError: error });
  }

  // 현재 상태 조회
  getState(): MediaConnectionState {
    return { ...this.state };
  }
}