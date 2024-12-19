export interface ChatMessage {
  messageId: string;
  channelId: number;
  message: string;
  sender: string; // email
  senderName: string; // 현재 username
  timestamp: number;
  type: string;
  profile_image: string; // 현재 profile image, snake_case에서 camelCase로 변경
}

export interface WebSocketCommand {
  type: 'SUBSCRIBE' | 'SEND' | 'UNSUBSCRIBE';
  channelId: number;
  payload?: ChatMessage;
}
