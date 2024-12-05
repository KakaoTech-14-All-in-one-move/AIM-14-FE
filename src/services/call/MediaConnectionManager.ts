import { MediaState, MediaType } from './types';
import { MediaServerConnection } from './webrtc/MediaServerConnection';
import { CallConnection } from './socket/callConnection';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { useAuthStore } from '@/stores/authStore';
import { UserStateManager } from '@/services/call/UserStateManager.ts';

export class MediaConnectionManager {
  private static instance: MediaConnectionManager | null = null;
  private static callConnection: CallConnection | null = null;
  private mediaServer: MediaServerConnection;
  private stateUpdateCallbacks: Set<(channelId: string | null) => void>;
  private userStateManager: UserStateManager;

  private constructor() {
    this.mediaServer = MediaServerConnection.getInstance();
    this.userStateManager = UserStateManager.getInstance();
    this.stateUpdateCallbacks = new Set();
  }

  static getInstance(): MediaConnectionManager {
    if (!this.instance) {
      this.instance = new MediaConnectionManager();
    }
    return this.instance;
  }

  setCallConnection(connection: CallConnection) {
    MediaConnectionManager.callConnection = connection;
    this.mediaServer.setCallConnection(connection);
  }

  static getCallConnection(): CallConnection | null {
    return MediaConnectionManager.callConnection;
  }

  private notifyStateUpdate(channelId: string | null) {
    this.stateUpdateCallbacks.forEach(callback => callback(channelId));
  }

  async joinChannel(channelId: string, type: MediaType): Promise<boolean> {
    try {
      // 연결 상태 체크 추가
      if (!MediaConnectionManager.getCallConnection()) {
        console.error('No CallConnection available : ', MediaConnectionManager.getCallConnection());
        return false;
      }

      // 1. 현재 채널이 있다면 먼저 나가기
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        await this.leaveChannel();
      }

      // 2. 소켓으로 채널 입장
      const success = await MediaConnectionManager.getCallConnection()!.joinChannel(channelId, type);
      if (!success) {
        console.error('Failed to join channel via CallConnection');
        return false;
      }

      // 3. 로컬 미디어 스트림 설정
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      if (!stream) {
        console.error('Failed to get local media stream');
        return false;
      }

      // 4. WebRTC 연결 준비
      try {
        await this.mediaServer.prepareConnection(channelId);
      } catch (error) {
        console.error('Failed to prepare WebRTC connection:', error);
        return false;
      }

      // 5. WebRTC 연결 시작
      try {
        await this.mediaServer.connect();
      } catch (error) {
        console.error('Failed to establish WebRTC connection:', error);
        return false;
      }

      // 6. 스토어 상태 업데이트
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        console.error('No current user found');
        return false;
      }

      useUserChannelStore.getState().setCurrentUserChannel(channelId, type);
      this.userStateManager.handleUserJoin(channelId, {
        user_id: currentUser.email,
        username: currentUser.username,
        profile_image: currentUser.profile_image,
        channel_id: channelId,
        muted: false,
        deafened: false,
        camera_on: false,
        screen_sharing: false,
      });

      // 스트림 업데이트
      this.userStateManager.updateUserStream(channelId, currentUser.email, stream);

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

      // 1. MediaServerConnection에서 현재 활성화된 모든 미디어 스트림을 가져옴
      const userState = useUserChannelStore.getState()
        .channelUsers.get(currentChannel.channelId)
        ?.find(user => user.userId === useAuthStore.getState().user?.email);

      // 2. 스트림이 있으면 모든 트랙 중지
      if (userState?.mediaState.stream) {
        userState.mediaState.stream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // 3. 스크린 공유 스트림이 있으면 중지
      if (userState?.mediaState.screenStream) {
        userState.mediaState.screenStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // 4. 소켓으로 채널 퇴장
      MediaConnectionManager.getCallConnection()?.leaveChannel();

      // 5. 미디어 연결 정리
      this.mediaServer.disconnect();

      // 6. 스토어 상태 초기화
      this.userStateManager.handleUserLeave(
        currentChannel.channelId,
        useAuthStore.getState().user?.email || '',
      );

      // 7. 채널에 남은 사용자가 없으면 채널 자체를 Map에서 제거
      const channelUsers = useUserChannelStore.getState().channelUsers;
      const remainingUsers = channelUsers.get(currentChannel.channelId) || [];
      if (remainingUsers.length === 0) {
        useUserChannelStore.getState().resetChannel(currentChannel.channelId);
      }

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

      // 1. 현재 상태 가져오기
      const channelUsers = useUserChannelStore.getState().channelUsers;
      const currentUserState = channelUsers.get(currentUserChannel.channelId)?.find(
        user => user.userId === currentUser.email,
      );

      if (!currentUserState) return;

      // 2. 현재 상태와 업데이트를 병합
      const serverUpdates = {
        muted: 'isMuted' in updates ? updates.isMuted : currentUserState.mediaState.isMuted,
        deafened: 'isDeafened' in updates ? updates.isDeafened : currentUserState.mediaState.isDeafened,
        camera_on: 'isCameraOn' in updates ? updates.isCameraOn : currentUserState.mediaState.isCameraOn,
        screen_sharing: 'isScreenSharing' in updates ? updates.isScreenSharing : currentUserState.mediaState.isScreenSharing,
      };

      // 3. 미디어 상태 업데이트 로직
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
            this.userStateManager.updateUserStream(
              currentUserChannel.channelId,
              currentUser.email,
              stream,
              true,
            );
          }
        } else {
          await this.mediaServer.stopScreenShare();
          updates.screenStream = null;
          this.userStateManager.updateUserStream(
            currentUserChannel.channelId,
            currentUser.email,
            null,
            true,
          );
        }
      }

      // 4. 서버에 상태 업데이트 전송
      MediaConnectionManager.getCallConnection()?.updateState(serverUpdates);

      // 5. 로컬 상태 업데이트
      this.userStateManager.handleUserStateUpdate(
        currentUserChannel.channelId,
        currentUser.email,
        serverUpdates,
      );

    } catch (error) {
      console.error('Error updating media state:', error);
    }
  }

  dispose() {
    this.mediaServer.dispose();
    this.stateUpdateCallbacks.clear();
    MediaConnectionManager.instance = null;
  }
}