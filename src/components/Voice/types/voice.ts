export interface User {
  id: string;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  imageUrl?: string;
}