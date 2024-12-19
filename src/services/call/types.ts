export type MediaType = 'VOICE' | 'VIDEO';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

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
  screenStream?: MediaStream | null;
}

export interface MediaState {
  // Channel state
  channelId: string | null;
  channelType: MediaType | null;

  // Media states
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;

  stream: MediaStream | null;
  screenStream: MediaStream | null;

  // Device IDs
  currentAudioInputId: string | null;
  currentAudioOutputId: string | null;
  currentVideoInputId: string | null;
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