// src/services/chat/websocket.ts
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/stores/authStore';

type MessageHandler = (message: { sender: string; content: string; profileImage: string }) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private client: Client | null = null;
  private currentChannelId: string | null = null;
  private messageHandler: MessageHandler | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS(`${import.meta.env.VITE_BE_SERVER_URL}/ws`),
        onConnect: () => {
          console.log('WebSocket Connected');
          resolve();
        },
        onStompError: (frame) => {
          console.error('WebSocket Error:', frame);
          reject(frame);
        },
      });

      this.client.activate();
    });
  }

  public disconnect() {
    if (this.client) {
      this.unsubscribeFromChannel();
      this.client.deactivate();
    }
  }

  public setMessageHandler(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  public subscribeToChannel(channelId: string) {
    if (!this.client || !channelId) return;

    this.unsubscribeFromChannel();
    this.currentChannelId = channelId;

    this.client.subscribe(`/sub/chat/${channelId}`, (message) => {
      const chatMessage = JSON.parse(message.body);
      if (this.messageHandler) {
        this.messageHandler({
          sender: chatMessage.sender,
          content: chatMessage.content,
          profileImage: chatMessage.profileImage,
        });
      }
    });
  }

  public unsubscribeFromChannel() {
    if (this.client && this.currentChannelId) {
      this.client.unsubscribe(`/sub/chat/${this.currentChannelId}`);
      this.currentChannelId = null;
    }
  }

  public sendMessage(channelId: string, content: string) {
    if (!this.client) return;

    const user = useAuthStore.getState().user;
    if (!user) return;

    this.client.publish({
      destination: `/pub/chat/${channelId}`,
      body: JSON.stringify({
        sender: user.username,
        content: content,
        profileImage: user.profile_image,
      }),
    });
  }
}

export default WebSocketService;
