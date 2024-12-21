import { ChannelUser, useUserChannelStore } from '@/stores/userChannelStore';

interface UserData {
  user_id: string;
  username: string;
  profile_image?: string;
  channel_id: string;
  muted: boolean;
  deafened: boolean;
  camera_on: boolean;
  screen_sharing: boolean;
}

export class UserStateManager {
  private static instance: UserStateManager | null = null;
  private stateUpdateCallbacks: Set<(channelId: string, userId: string) => void>;
  private joinedUsers: Set<string>; // 채널별 사용자 추적을 위한 Set

  private constructor() {
    this.stateUpdateCallbacks = new Set();
    this.joinedUsers = new Set();
  }

  static getInstance(): UserStateManager {
    if (!this.instance) {
      this.instance = new UserStateManager();
    }
    return this.instance;
  }

  handleServerState(channelUsers: UserData[]) {
    console.log('Handling server state with users:', channelUsers);
    const channelUsersMap = new Map<string, ChannelUser[]>();

    // 기존의 joined users 초기화
    this.joinedUsers.clear();

    channelUsers.forEach(userData => {
      if (!userData.channel_id || !userData.user_id) {
        console.warn('Invalid user data:', userData);
        return;
      }

      const channelId = userData.channel_id;
      const users = channelUsersMap.get(channelId) || [];

      // 현재 채널 상태 가져오기
      const existingUser = useUserChannelStore.getState().channelUsers
        .get(channelId)?.find(u => u.userId === userData.user_id);

      const convertedUser = this.convertUserData(userData);
      if (existingUser) {
        convertedUser.mediaState.stream = existingUser.mediaState.stream;
        convertedUser.mediaState.screenStream = existingUser.mediaState.screenStream;
      }

      users.push(convertedUser);
      channelUsersMap.set(channelId, users);

      // joined users에 추가
      this.joinedUsers.add(`${channelId}:${userData.user_id}`);
    });

    channelUsersMap.forEach((users, channelId) => {
      useUserChannelStore.getState().setChannelUsers(channelId, users);
      console.log(`Updated channel ${channelId} with ${users.length} users`);
    });
  }

  handleUserJoin(channelId: string, userData: UserData) {
    console.log('Handling user join:', { channelId, userData });

    if (!userData.user_id || !channelId) {
      console.error('Invalid user data or channel ID:', { userData, channelId });
      return;
    }

    const userKey = `${channelId}:${userData.user_id}`;
    if (this.joinedUsers.has(userKey)) {
      console.log(`User ${userData.user_id} already exists in channel ${channelId}`);
      return;
    }

    try {
      const channelUser = this.convertUserData({
        ...userData,
        channel_id: channelId,
      });

      useUserChannelStore.getState().addChannelUser(channelId, channelUser);
      this.joinedUsers.add(userKey);
      this.notifyStateUpdate(channelId, userData.user_id);
      console.log(`User ${userData.user_id} successfully joined channel ${channelId}`);
    } catch (error) {
      console.error('Error in handleUserJoin:', error);
    }
  }

  handleUserLeave(channelId: string, userId: string) {
    console.log('Handling user leave:', { channelId, userId });

    if (!userId || !channelId) {
      console.error('Invalid user ID or channel ID:', { userId, channelId });
      return;
    }

    try {
      const userKey = `${channelId}:${userId}`;
      this.joinedUsers.delete(userKey);

      useUserChannelStore.getState().removeChannelUser(channelId, userId);
      this.notifyStateUpdate(channelId, userId);
      console.log(`User ${userId} successfully left channel ${channelId}`);
    } catch (error) {
      console.error('Error in handleUserLeave:', error);
    }
  }

  handleUserStateUpdate(channelId: string, userId: string, updates: any) {
    console.log('Handling user state update:', { channelId, userId, updates });

    if (!userId || !channelId) {
      console.error('Invalid user ID or channel ID:', { userId, channelId });
      return;
    }

    try {
      // 현재 채널 상태 확인
      const currentUsers = useUserChannelStore.getState().channelUsers.get(channelId);

      // 채널이 없는 경우 생성
      if (!currentUsers) {
        console.warn(`Channel ${channelId} not found, initializing channel`);
        useUserChannelStore.getState().setChannelUsers(channelId, []);
      }

      // 현재 사용자 찾기
      const currentUser = currentUsers?.find(user => user.userId === userId);

      // 사용자가 없는 경우 새로 추가
      if (!currentUser) {
        console.warn(`User ${userId} not found in channel ${channelId}, adding new user state`);
        // 현재 인증된 사용자 정보 가져오기
        const authUser = useAuthStore.getState().user;

        if (authUser && authUser.user_id.toString() === userId) {
          this.handleUserJoin(channelId, {
            user_id: userId,
            username: authUser.username,
            channel_id: channelId,
            muted: false,
            deafened: false,
            camera_on: false,
            screen_sharing: false
          });
        }
      }

      // 상태 업데이트 적용
      const updatedMediaState = {
        isMuted: updates.muted ?? currentUser?.mediaState.isMuted ?? false,
        isDeafened: updates.deafened ?? currentUser?.mediaState.isDeafened ?? false,
        isCameraOn: updates.camera_on ?? currentUser?.mediaState.isCameraOn ?? false,
        isScreenSharing: updates.screen_sharing ?? currentUser?.mediaState.isScreenSharing ?? false,
        stream: updates.stream ?? currentUser?.mediaState.stream ?? null,
        screenStream: updates.screenStream ?? currentUser?.mediaState.screenStream ?? null,
        isSpeaking: updates.isSpeaking ?? currentUser?.mediaState.isSpeaking ?? false,
      };

      useUserChannelStore.getState().updateUserMediaState(channelId, userId, updatedMediaState);
      this.notifyStateUpdate(channelId, userId);

      console.log('User state updated successfully:', {
        channelId,
        userId,
        updatedState: {
          ...updatedMediaState,
          hasStream: !!updatedMediaState.stream,
          hasScreenStream: !!updatedMediaState.screenStream,
        }
      });
    } catch (error) {
      console.error('Error in handleUserStateUpdate:', error);
    }
  }

  updateUserStream(channelId: string, userId: string, stream: MediaStream | null, isScreenShare: boolean = false) {
    if (!userId || !channelId) {
      console.error('Invalid user ID or channel ID:', { userId, channelId });
      return;
    }

    try {
      const update = isScreenShare ? { screenStream: stream } : { stream };
      console.log(`Updating ${isScreenShare ? 'screen share' : 'media'} stream for user ${userId}`);

      useUserChannelStore.getState().updateUserMediaState(channelId, userId, update);
      this.notifyStateUpdate(channelId, userId);
    } catch (error) {
      console.error('Error in updateUserStream:', error);
    }
  }

  private notifyStateUpdate(channelId: string, userId: string) {
    this.stateUpdateCallbacks.forEach(callback => callback(channelId, userId));
  }

  private convertUserData(userData: UserData): ChannelUser {
    if (!userData.user_id || !userData.channel_id) {
      throw new Error('Invalid user data: missing required fields');
    }

    return {
      userId: userData.user_id,
      username: userData.username,
      profileImage: userData.profile_image,
      channelId: userData.channel_id,
      mediaState: {
        isMuted: userData.muted,
        isDeafened: userData.deafened,
        isCameraOn: userData.camera_on,
        isScreenSharing: userData.screen_sharing,
        isSpeaking: false,
        stream: null,
        screenStream: null,
      },
    };
  }

  dispose() {
    this.stateUpdateCallbacks.clear();
    this.joinedUsers.clear();
    UserStateManager.instance = null;
  }
}