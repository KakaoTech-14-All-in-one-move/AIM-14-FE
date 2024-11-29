import { ChannelType } from '@/components/Home/Channelbar/types';

export type MediaChannelType = 'VOICE' | 'VIDEO';

export interface ServerChannel {
  id: string;
  name: string;
  type: ChannelType;
}

export interface ServerData {
  id: string;
  name: string;
  channels: ServerChannel[];
}

export interface ChannelMapping {
  serverId: string;
  channelName: string;
  channelId: string;
  channelType: MediaChannelType;
}

// User and state related types
export interface CallUserData {
  user_id: string;
  username: string;  // 필수 필드로 변경
  server_id: string;
  channel_id: string;
  channel_type: string;
  profile_image?: string;
  speaking?: boolean;
  muted?: boolean;
  deafened?: boolean;
  camera_on?: boolean;
  screen_sharing?: boolean;
  stream?: MediaStream | null;
}

export type VoiceStateUpdate = Partial<Pick<CallUserData,
  'muted' |
  'deafened' |
  'speaking' |
  'camera_on' |
  'screen_sharing'
>>;

export interface CallState {
  users: CallUserData[];
  currentUser: CallUserData | null;
  connectionStatus: string;
}

export interface LeaveChannelData {
  user_id: string;
  server_id: string;
  channel_id: string;
  channel_type: string;
}

export interface CallServerMessage {
  op: number;
  data?: {
    heartbeat_interval?: number;
    users?: CallUserData[];
    user?: CallUserData;
  } | CallUserData | LeaveChannelData;
  seq?: string;
}