export interface Chat {
  messageId: string;
  channelId: number;
  timestamp: number;
  type: 'ENTER' | 'TALK' | 'LEAVE';
  sender: string;
  senderName: string;
  message: string;
  profile_image?: string;
}

export interface WebSocketCommand {
  type: 'SUBSCRIBE' | 'SEND' | 'UNSUBSCRIBE';
  channelId: number;
  payload?: Chat;
}
