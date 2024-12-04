export type MediaType = 'VOICE' | 'VIDEO';
export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'CLOSED' | 'ERROR';

export interface CallUserData {
  user_id: string;
  username: string;
  server_id: string;
  channel_id: string;
  channel_type: MediaType;
  profile_image?: string;
  speaking?: boolean;
  muted?: boolean;
  deafened?: boolean;
  camera_on?: boolean;
  screen_sharing?: boolean;
}

export interface VoiceStateUpdate {
  muted?: boolean;
  deafened?: boolean;
  speaking?: boolean;
  camera_on?: boolean;
  screen_sharing?: boolean;
}

export interface ChannelEventData {
  user_id: string;
  server_id: string;
  channel_id: string;
  channel_type: MediaType;
}

// src/types/media.ts
export interface MediaUser {
  userId: string;
  username: string;
  profileImage?: string;
  channelId: string;
  channelType: MediaType;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
}

export interface MediaUserState {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
}

export interface ChatState {
  userStates: Map<string, MediaUserState>;
  speakingUsers: Set<string>;
  currentUserId: string | null;
}

export interface WebRTCState {
  isConnected: boolean;
  isInChannel: boolean;
  hasMicPermission: boolean;
  hasCameraPermission: boolean;
  currentAudioInputId: string | null;
  currentAudioOutputId: string | null;
  currentVideoInputId: string | null;
}

export interface WebRTCEvents {
  onTrack?: (stream: MediaStream, userId: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export const convertCallUserToMediaUser = (user: CallUserData): MediaUser => ({
  userId: user.user_id,
  username: user.username,
  profileImage: user.profile_image,
  channelId: user.channel_id,
  channelType: user.channel_type,
  muted: user.muted ?? false,
  deafened: user.deafened ?? false,
  speaking: user.speaking ?? false,
  cameraOn: user.camera_on ?? false,
  screenSharing: user.screen_sharing ?? false,
  stream: null,
  screenStream: null,
});