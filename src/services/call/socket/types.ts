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

export interface CallUserData {
  user_id: string;
  username: string;
  server_id: string;
  channel_id: string;
  channel_type: MediaChannelType;
  profile_image?: string;
  speaking?: boolean;
  muted?: boolean;
  deafened?: boolean;
  camera_on?: boolean;
  screen_sharing?: boolean;
  stream?: MediaStream | null;
}

export interface VoiceStateUpdate {
  muted?: boolean;
  deafened?: boolean;
  speaking?: boolean;
  camera_on?: boolean;
  screen_sharing?: boolean;
}

export interface CallState {
  users: CallUserData[];
  currentUser: CallUserData | null;
  connectionStatus: ConnectionStatus;
}

export interface ChannelEventData {
  user_id: string;
  server_id: string;
  channel_id: string;
  channel_type: MediaChannelType;
}

export interface ErrorData {
  code: number;
  message: string;
}

export interface WebSocketMessage {
  op: number;
  data?: any;
  seq?: string;
}

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'CLOSED'
  | 'ERROR';