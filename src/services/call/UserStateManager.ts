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
  stream: MediaStream | null;
}

export class UserStateManager {
  private static instance: UserStateManager | null = null;
  private stateUpdateCallbacks: Set<(channelId: string, userId: string) => void>;
  private joinedUsers: Set<string>; // 채널별 사용자 추적을 위한 Set

  private constructor() {
    this.stateUpdateCallbacks = new Set();
    this.joinedUsers = new Set();
  }

  resetJoinedUsers() {
    this.joinedUsers.clear();
  }

  static getInstance(): UserStateManager {
    if (!this.instance) {
      this.instance = new UserStateManager();
    }
    return this.instance;
  }

  handleServerState(channelUsers: UserData[]) {
    const channelUsersMap = new Map<string, ChannelUser[]>();
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

      // 새로운 유저 데이터 생성
      const convertedUser = this.convertUserData(userData);

      if (existingUser) {
        // 기존 유저의 경우, 스트림과 카메라 상태를 보존
        convertedUser.mediaState = {
          ...convertedUser.mediaState,
          stream: existingUser.mediaState.stream,
          screenStream: existingUser.mediaState.screenStream,
          isCameraOn: existingUser.mediaState.isCameraOn
        };
      }

      users.push(convertedUser);
      channelUsersMap.set(channelId, users);
      this.joinedUsers.add(`${channelId}:${userData.user_id}`);
    });

    channelUsersMap.forEach((users, channelId) => {
      useUserChannelStore.getState().setChannelUsers(channelId, users);
    });
  }

  handleUserJoin(channelId: string, userData: UserData) {
    console.log('UserStateManager - handleUserJoin', userData);

    if (!userData.user_id || !channelId) {
      console.error('Invalid user data or channel ID:', { userData, channelId });
      return;
    }

    const userKey = `${channelId}:${userData.user_id}`;
    // 이미 존재하는 경우 기존 상태 정리 후 재가입
    if (this.joinedUsers.has(userKey)) {
      // this.handleUserLeave(channelId, userData.user_id);
      console.warn('User is already in joinedUsers Set', userKey);
      return;
    }

    try {
      const channelUser = this.convertUserData(userData);
      console.log('Create channel user:', channelUser);

      useUserChannelStore.getState().addChannelUser(channelId, channelUser);
      console.log('ChannelUsers Map:', useUserChannelStore.getState().channelUsers);
      this.joinedUsers.add(userKey);
      this.notifyStateUpdate(channelId, userData.user_id);
    } catch (error) {
      console.error('Error in handleUserJoin:', error);
    }
  }

  private convertUserData(userData: UserData): ChannelUser {
    // console.log('Converting user data in UserStateManager:', userData);

    if (!userData.user_id || !userData.channel_id) {
      throw new Error('Invalid user data: missing required fields');
    }

    const channelUser = {
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
        stream: userData.stream,
        screenStream: null,
      },
    };

    // console.log('Converted to channel user:', channelUser);
    return channelUser;
  }

  handleUserLeave(channelId: string, userId: string) {
    // console.log('Handling user leave:', { channelId, userId });

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
    if (!userId || !channelId) {
      console.error('Invalid user ID or channel ID:', { userId, channelId });
      return;
    }

    try {
      const userKey = `${channelId}:${userId}`;
      if (!this.joinedUsers.has(userKey)) {
        console.warn(`User ${userId} not found in joined users for channel ${channelId}`);
        return;
      }

      const currentUsers = useUserChannelStore.getState().channelUsers.get(channelId);
      if (!currentUsers) {
        console.error('Channel not found:', channelId);
        return;
      }

      const currentUser = currentUsers.find(user => user.userId === userId);
      if (!currentUser) {
        console.error('User not found in channel:', userId);
        return;
      }

      // camera_on이 명시적으로 제공된 경우에만 업데이트
      const updatedMediaState = {
        ...currentUser.mediaState,
        isMuted: updates.muted ?? currentUser.mediaState.isMuted,
        isDeafened: updates.deafened ?? currentUser.mediaState.isDeafened,
        isScreenSharing: updates.screen_sharing ?? currentUser.mediaState.isScreenSharing,
        stream: updates.stream ?? currentUser.mediaState.stream,
        screenStream: updates.screenStream ?? currentUser.mediaState.screenStream,
        isSpeaking: updates.isSpeaking ?? currentUser.mediaState.isSpeaking,
      };

      // camera_on이 명시적으로 제공된 경우에만 업데이트
      if ('camera_on' in updates) {
        updatedMediaState.isCameraOn = updates.camera_on;
      }

      useUserChannelStore.getState().updateUserMediaState(channelId, userId, updatedMediaState);
      this.notifyStateUpdate(channelId, userId);
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

  // private convertUserData(userData: UserData): ChannelUser {
  //   if (!userData.user_id || !userData.channel_id) {
  //     throw new Error('Invalid user data: missing required fields');
  //   }
  //
  //   return {
  //     userId: userData.user_id,
  //     username: userData.username,
  //     profileImage: userData.profile_image,
  //     channelId: userData.channel_id,
  //     mediaState: {
  //       isMuted: userData.muted,
  //       isDeafened: userData.deafened,
  //       isCameraOn: userData.camera_on,
  //       isScreenSharing: userData.screen_sharing,
  //       isSpeaking: false,
  //       stream: null,
  //       screenStream: null,
  //     },
  //   };
  // }

  dispose() {
    this.stateUpdateCallbacks.clear();
    this.joinedUsers.clear();
    UserStateManager.instance = null;
  }
}