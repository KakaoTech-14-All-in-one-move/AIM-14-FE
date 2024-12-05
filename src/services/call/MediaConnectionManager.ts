import { MediaState, MediaType } from './types';
import { MediaServerConnection } from './webrtc/MediaServerConnection';
import { CallConnection } from './socket/callConnection';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { useAuthStore } from '@/stores/authStore';

export class MediaConnectionManager {
  private static instance: MediaConnectionManager | null = null;
  private mediaServer: MediaServerConnection;
  private callConnection: CallConnection | null = null;
  private stateUpdateCallbacks: Set<(channelId: string | null) => void>;

  private constructor() {
    this.mediaServer = MediaServerConnection.getInstance();
    this.stateUpdateCallbacks = new Set();
  }

  static getInstance(): MediaConnectionManager {
    if (!this.instance) {
      this.instance = new MediaConnectionManager();
    }
    return this.instance;
  }

  setCallConnection(connection: CallConnection) {
    this.callConnection = connection;
    this.mediaServer.setCallConnection(connection);
  }

  onStateUpdate(callback: (channelId: string | null) => void) {
    this.stateUpdateCallbacks.add(callback);
    return () => this.stateUpdateCallbacks.delete(callback);
  }

  private notifyStateUpdate(channelId: string | null) {
    this.stateUpdateCallbacks.forEach(callback => callback(channelId));
  }

  async joinChannel(channelId: string, type: MediaType): Promise<boolean> {
    try {
      // 1. 현재 채널이 있다면 먼저 나가기
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        await this.leaveChannel();
      }

      // 2. 소켓으로 채널 입장
      const success = await this.callConnection?.joinChannel(channelId, type);
      if (!success) {
        throw new Error('Failed to join channel');
      }

      // 3. 로컬 미디어 스트림 설정
      const stream = await this.mediaServer.updateLocalStream(type);
      if (!stream) {
        throw new Error('Failed to get local stream');
      }

      // 4. WebRTC 연결 준비
      await this.mediaServer.prepareConnection(channelId);

      // 5. WebRTC 연결 시작
      await this.mediaServer.connect();

      // 6. 스토어 상태 업데이트
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return false;

      useUserChannelStore.getState().setCurrentUserChannel(channelId, type);
      useUserChannelStore.getState().addChannelUser(channelId, {
        userId: currentUser.email,
        username: currentUser.username,
        profileImage: currentUser.profile_image,
        channelId: channelId,
        mediaState: {
          isMuted: false,
          isDeafened: false,
          isCameraOn: type === 'VIDEO',
          isScreenSharing: false,
          isSpeaking: false,
          stream,
          screenStream: null,
        },
      });

      this.notifyStateUpdate(channelId);
      return true;

    } catch (error) {
      console.error('Error joining channel:', error);
      await this.leaveChannel();
      return false;
    }
  }

  async leaveChannel() {
    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (!currentChannel.channelId) return;

      // 1. 소켓으로 채널 퇴장
      this.callConnection?.leaveChannel();

      // 2. 미디어 연결 정리
      this.mediaServer.disconnect();

      // 3. 스토어 상태 초기화
      useUserChannelStore.getState().resetChannel(currentChannel.channelId);
      useUserChannelStore.getState().setCurrentUserChannel(null, null);

      this.notifyStateUpdate(null);
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  }

  async updateMediaState(updates: Partial<MediaState>) {
    try {
      const { currentUserChannel } = useUserChannelStore.getState();
      const currentUser = useAuthStore.getState().user;

      if (!currentUserChannel.channelId || !currentUser) return;

      // 1. 미디어 상태 업데이트
      if ('isMuted' in updates) {
        await this.mediaServer.toggleAudio(!updates.isMuted);
      }
      if ('isCameraOn' in updates) {
        await this.mediaServer.toggleVideo(!!updates.isCameraOn);
      }
      if ('isScreenSharing' in updates) {
        if (updates.isScreenSharing) {
          const stream = await this.mediaServer.startScreenShare();
          if (stream) {
            updates.screenStream = stream;
          }
        } else {
          await this.mediaServer.stopScreenShare();
          updates.screenStream = null;
        }
      }

      // 2. 스토어 상태 업데이트
      useUserChannelStore.getState().updateUserMediaState(
        currentUserChannel.channelId,
        currentUser.email,
        updates,
      );

      // 3. 서버에 상태 업데이트 전송
      const serverUpdates = {
        muted: updates.isMuted,
        deafened: updates.isDeafened,
        camera_on: updates.isCameraOn,
        screen_sharing: updates.isScreenSharing,
      } as Record<string, boolean | undefined>;

      // undefined인 속성 제거
      const filteredUpdates = Object.fromEntries(
        Object.entries(serverUpdates).filter(([_, value]) => value !== undefined)
      );

      this.callConnection?.updateState(filteredUpdates);

    } catch (error) {
      console.error('Error updating media state:', error);
    }
  }

  handleUserJoin(channelId: string, userData: any) {
    if (!this.isValidUserData(userData)) return;

    useUserChannelStore.getState().addChannelUser(channelId, {
      userId: userData.user_id,
      username: userData.username,
      profileImage: userData.profile_image,
      channelId,
      mediaState: {
        isMuted: userData.muted || false,
        isDeafened: userData.deafened || false,
        isCameraOn: userData.camera_on || false,
        isScreenSharing: userData.screen_sharing || false,
        isSpeaking: false,
        stream: null,
        screenStream: null,
      },
    });
  }

  async handleUserLeave(channelId: string, userId: string) {
    // 사용자 퇴장 처리
    useUserChannelStore.getState().removeChannelUser(channelId, userId);
  }

  handleUserStateUpdate(channelId: string, userId: string, updates: any) {
    useUserChannelStore.getState().updateUserMediaState(channelId, userId, {
      isMuted: updates.muted,
      isDeafened: updates.deafened,
      isCameraOn: updates.camera_on,
      isScreenSharing: updates.screen_sharing,
      isSpeaking: updates.speaking
    });
  }

  private isValidUserData(data: any): boolean {
    return (
      data &&
      typeof data.user_id === 'string' &&
      typeof data.username === 'string'
    );
  }

  dispose() {
    this.mediaServer.dispose();
    this.stateUpdateCallbacks.clear();
    MediaConnectionManager.instance = null;
  }
}