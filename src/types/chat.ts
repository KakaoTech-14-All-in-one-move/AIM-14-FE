export interface ChatMessage {
  messageId: string;
  channelId: number;
  message: string;
  sender: string; // email
  senderName: string; // 현재 username
  timestamp: number;
  type: string;
  profile_image: string;
}

export interface WebSocketCommand {
  type: 'SUBSCRIBE' | 'SEND' | 'UNSUBSCRIBE';
  channelId: number;
  payload?: ChatMessage;
}
