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
      if (!MediaConnectionManager.getCallConnection()) {
        console.error('No CallConnection available');
        return false;
      }

      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        await this.leaveChannel();
      }

      const success = await MediaConnectionManager.getCallConnection()!.joinChannel(channelId, type);
      if (!success) {
        console.error('Failed to join channel via CallConnection');
        return false;
      }

      // 연결 준비
      try {
        await this.mediaServer.prepareConnection(channelId);
      } catch (error) {
        console.error('Failed to prepare WebRTC connection:', error);
        return false;
      }

      // 오디오 전용 스트림으로 시작 (카메라는 꺼진 상태로 시작)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });

        if (!stream) {
          console.error('Failed to get audio stream');
          return false;
        }

        this.mediaServer.replaceStream(stream);
      } catch (error) {
        console.error('Failed to get initial audio stream:', error);
        return false;
      }

      // WebRTC 연결 수립
      try {
        await this.mediaServer.connect();
      } catch (error) {
        console.error('Failed to establish WebRTC connection:', error);
        return false;
      }

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

      // 1. 현재 채널의 사용자 상태 가져오기
      const userState = useUserChannelStore.getState()
        .channelUsers.get(currentChannel.channelId)
        ?.find(user => user.userId === useAuthStore.getState().user?.email);

      if (userState) {
        // 2. 모든 미디어 스트림 정리
        if (userState.mediaState.stream) {
          userState.mediaState.stream.getTracks().forEach(track => {
            track.stop();
          });
        }
        if (userState.mediaState.screenStream) {
          userState.mediaState.screenStream.getTracks().forEach(track => {
            track.stop();
          });
        }
      }

      // 3. MediaServer 연결 정리 (이 안에서 모든 트랙과 연결을 정리)
      this.mediaServer.disconnect();

      // 4. 소켓으로 채널 퇴장
      MediaConnectionManager.getCallConnection()?.leaveChannel();

      // 5. 스토어 상태 초기화
      if (userState) {
        this.userStateManager.handleUserLeave(
          currentChannel.channelId,
          useAuthStore.getState().user?.email || ''
        );
      }

      // 6. 채널 정리
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

      // 3. 카메라 상태 변경 처리
      if ('isCameraOn' in updates) {
        try {
          if (updates.isCameraOn) {
            // 카메라 켤 때: 오디오와 비디오 모두 포함된 새 스트림
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true
            });

            this.mediaServer.replaceStream(newStream);
            updates.stream = newStream;
          } else {
            // 카메라 끌 때: 오디오만 있는 새 스트림
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false
            });

            this.mediaServer.replaceStream(audioOnlyStream);
            updates.stream = audioOnlyStream;
          }
        } catch (error) {
          console.error('Failed to toggle camera:', error);
          return;
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

      // 6. 스트림 업데이트가 있으면 처리
      if (updates.stream) {
        this.userStateManager.updateUserStream(
          currentUserChannel.channelId,
          currentUser.email,
          updates.stream
        );
      }

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