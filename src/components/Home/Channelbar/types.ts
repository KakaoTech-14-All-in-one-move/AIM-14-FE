export type ChannelType = 'text' | 'voice' | 'video';

export interface Channels {
  text: string[];
  voice: string[];
  video: string[];
}

export interface ChannelStates {
  active: Record<string, boolean>;    // 다른 사용자가 있는 채널
  joined: Record<string, boolean>;    // 내가 참여한 채널
}

// ChannelStateType은 'text'를 제외한 채널 타입에 대해서만 상태를 가집니다
export type ChannelStateType = {
  voice: ChannelStates;
  video: ChannelStates;
};

// 기존 User 인터페이스를 AuthUser로 이름 변경 (authStore의 User와 구분)
export interface AuthUser {
  email: string;
  username: string;
  profile_image: string;
}

export interface ChannelContextType {
  channels: Channels;
  addChannel: (type: ChannelType, name: string) => void;
  openSections: Record<ChannelType, boolean>;
  toggleSection: (type: ChannelType) => void;
  channelStates: ChannelStateType;
  activateChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  deactivateChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  joinChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  leaveChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  renameChannel: (type: ChannelType, oldName: string, newName: string) => void;
  deleteChannel: (type: ChannelType, channelName: string) => void;
  currentUser: AuthUser | null;  // currentUser 추가
}

export const getUserData = (): AuthUser => ({
  email: 'example@example.com',
  username: 'Example User',
  profile_image: '/default-profile.png'
});