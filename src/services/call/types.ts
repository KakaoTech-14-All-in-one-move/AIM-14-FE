import { ChannelType } from '../../components/Home/Channelbar/types';

// Channel related types
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
  username: string;
  server_id: string;
  channel_id: string;
  channel_type: MediaChannelType;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  camera_on: boolean;
  screen_sharing: boolean;
}

export type VoiceStateUpdate = Partial<Pick<CallUserData,
  'muted' |
  'deafened' |
  'speaking' |
  'camera_on' |
  'screen_sharing'
>>;

export interface CallServerMessage {
  op: number;
  data?: {
    heartbeat_interval?: number;
    users?: CallUserData[];
    user?: CallUserData;
  } | CallUserData;  // 단일 유저 데이터 타입 추가
  seq?: string;  // 시퀀스 번호도 추가
}

export interface CallState {
  users: CallUserData[];
  currentUser: CallUserData | null;
  connectionStatus: string;
}