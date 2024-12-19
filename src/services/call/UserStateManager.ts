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

  private constructor() {
    this.stateUpdateCallbacks = new Set();
  }

  static getInstance(): UserStateManager {
    if (!this.instance) {
      this.instance = new UserStateManager();
    }
    return this.instance;
  }

  // 서버 응답 처리 (초기 상태 설정)
  handleServerState(channelUsers: UserData[]) {
    // console.log('UserStateManager received users:', channelUsers);
    // 기존 상태 초기화
    const channelUsersMap = new Map<string, ChannelUser[]>();

    // 채널별로 유저 그룹화 및 상태 변환
    channelUsers.forEach(userData => {
      if (!userData.channel_id) return;

      const channelId = userData.channel_id;
      const users = channelUsersMap.get(channelId) || [];

      // 이미 존재하는 유저의 스트림 정보 보존
      const existingUser = useUserChannelStore.getState().channelUsers
        .get(channelId)?.find(u => u.userId === userData.user_id);

      const convertedUser = this.convertUserData(userData);
      if (existingUser) {
        convertedUser.mediaState.stream = existingUser.mediaState.stream;
        convertedUser.mediaState.screenStream = existingUser.mediaState.screenStream;
      }

      users.push(convertedUser);
      channelUsersMap.set(channelId, users);
    });

    // 각 채널별로 상태 업데이트
    channelUsersMap.forEach((users, channelId) => {
      useUserChannelStore.getState().setChannelUsers(channelId, users);
    });
  }

  // 채널 입장 이벤트 처리
  handleUserJoin(channelId: string, userData: UserData) {
    console.log('UserStateManager handling user join:', { channelId, userData });

    const channelUser = this.convertUserData({
      ...userData,
      channel_id: channelId,
    });

    console.log('Converted channel user:', channelUser);
    useUserChannelStore.getState().addChannelUser(channelId, channelUser);
    this.notifyStateUpdate(channelId, userData.user_id);
  }

  // 채널 퇴장 이벤트 처리
  handleUserLeave(channelId: string, userId: string) {
    useUserChannelStore.getState().removeChannelUser(channelId, userId);
    this.notifyStateUpdate(channelId, userId);
  }

  // 유저 상태 업데이트 처리
  handleUserStateUpdate(channelId: string, userId: string, updates: any) {
    console.log('Handling user state update:', { channelId, userId, updates });

    // 상태 업데이트 전에 현재 상태 확인
    const currentUsers = useUserChannelStore.getState().channelUsers.get(channelId);
    if (!currentUsers) {
      console.error('No users found for channel:', channelId);
      return;
    }

    // 현재 사용자의 상태를 찾아서 스트림 정보 보존
    const currentUser = currentUsers.find(user => user.userId === userId);
    const currentStream = currentUser?.mediaState.stream;
    const currentScreenStream = currentUser?.mediaState.screenStream;

    useUserChannelStore.getState().updateUserMediaState(channelId, userId, {
      isMuted: updates.muted !== undefined ? updates.muted : false,
      isDeafened: updates.deafened !== undefined ? updates.deafened : false,
      isCameraOn: updates.camera_on !== undefined ? updates.camera_on : false,
      isScreenSharing: updates.screen_sharing !== undefined ? updates.screen_sharing : false,
      stream: updates.stream || currentStream, // 기존 스트림 보존
      screenStream: updates.screenStream || currentScreenStream, // 화면 공유 스트림 보존
    });

    // 상태 업데이트 후 로그
    console.log('User state updated:', {
      channelId,
      userId,
      updates,
      hasStream: !!updates.stream,
      hasScreenStream: !!updates.screenStream,
    });
  }

  // 스트림 업데이트 처리
  updateUserStream(channelId: string, userId: string, stream: MediaStream | null, isScreenShare: boolean = false) {
    const update = isScreenShare ? { screenStream: stream } : { stream };
    useUserChannelStore.getState().updateUserMediaState(channelId, userId, update);
    this.notifyStateUpdate(channelId, userId);
  }

  // 상태 변경 알림 구독
  onStateUpdate(callback: (channelId: string, userId: string) => void) {
    this.stateUpdateCallbacks.add(callback);
    return () => this.stateUpdateCallbacks.delete(callback);
  }

  private notifyStateUpdate(channelId: string, userId: string) {
    this.stateUpdateCallbacks.forEach(callback => callback(channelId, userId));
  }

  private convertUserData(userData: UserData): ChannelUser {
    return {
      userId: userData.user_id,
      username: userData.username,
      profileImage: userData.profile_image,
      channelId: userData.channel_id,
      mediaState: {
        isMuted: userData.muted,
        isDeafened: userData.deafened,
        isCameraOn: false,
        isScreenSharing: userData.screen_sharing,
        isSpeaking: false,
        stream: null,
        screenStream: null,
      },
    };
  }

  dispose() {
    this.stateUpdateCallbacks.clear();
    UserStateManager.instance = null;
  }
}