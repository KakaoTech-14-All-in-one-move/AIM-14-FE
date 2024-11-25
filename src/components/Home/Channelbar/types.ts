import { Channel } from '@/types/server';

export type ChannelType = 'text' | 'voice' | 'video';

export interface Channels {
  [key: string]: Channel[];
}

export interface ChannelState {
  joined: Record<string, boolean>;
  active: Record<string, boolean>;
}

export interface ChannelStateType {
  voice: ChannelState;
  video: ChannelState;
}

export interface ChannelContextType {
  channels: Record<ChannelType, Channel[]>;
  addChannel: (type: ChannelType, channel: Channel) => void;
  renameChannel: (type: ChannelType, channelId: number, newName: string) => void;
  deleteChannel: (type: ChannelType, channelId: number) => void;
  openSections: Record<ChannelType, boolean>;
  toggleSection: (type: ChannelType) => void;
  channelStates: ChannelStateType;
  activateChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  deactivateChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  joinChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  leaveChannel: (type: Exclude<ChannelType, 'text'>, channelName: string) => void;
  currentUser: any;
}
