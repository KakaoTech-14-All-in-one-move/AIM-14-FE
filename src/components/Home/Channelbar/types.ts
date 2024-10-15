export type ChannelType = 'text' | 'voice' | 'video';

export interface Channels {
  text: string[];
  voice: string[];
  video: string[];
}

export interface User {
  nickname: string;
  profileImage: string;
  email: string;
}

export interface ChannelContextType {
  channels: Channels;
  addChannel: (type: ChannelType, name: string) => void;
  openSections: Record<ChannelType, boolean>;
  toggleSection: (type: ChannelType) => void;
  activeChannels: Record<Exclude<ChannelType, 'text'>, Record<string, boolean>>;
  joinChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  leaveChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  currentUser: User;
  renameChannel: (type: ChannelType, oldName: string, newName: string) => void;
  deleteChannel: (type: ChannelType, channelName: string) => void;
}

// Mock user data (in a real app, this would come from an API or authentication service)
export const currentUser: User = {
  nickname: '김영진',
  profileImage: '/google_login_logo.png', // Using a placeholder image
  email: 'youngjin.kim@example.com',
};

export const getUserData = (): User => {
  // In a real application, this function would fetch user data from an API
  // For now, we'll just return the mock data
  return currentUser;
};
