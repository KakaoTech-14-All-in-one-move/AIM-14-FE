export interface VideoUser {
  id: string;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  imageUrl?: string;
  stream?: MediaStream;
}

export interface VideoUserBoxProps {
  user: VideoUser;
}

export interface VideoControlsProps {
  show: boolean;
}