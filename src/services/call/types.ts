export type ChannelType = 'voice' | 'video' | 'text';
export type MediaChannelType = 'voice' | 'video';

export interface CallUserData {
  userId: string;
  username: string;
  serverId: string;
  channelId: string;
  channelType: MediaChannelType;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

export interface CallServerMessage {
  op: number;
  data?: {
    heartbeat_interval?: number;
    users?: CallUserData[];
    user?: CallUserData;
  };
}

export interface CallState {
  users: CallUserData[];
  currentUser: CallUserData | null;
  connectionStatus: string;
}