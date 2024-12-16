import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Message {
  messageId: string;
  message: string;
  sender: string;
  senderName: string;
  profile_image?: string;
  timestamp: Date;
  type?: 'ENTER' | 'TALK' | 'LEAVE';
}

interface User {
  email: string;
  id: string;
  username: string;
  profile_image?: string;
}

interface WebSocketStore {
  socket: Map<string, WebSocket>;
  messages: Record<string, Message[]>;
  isConnected: Record<string, boolean>;
  connect: (channelId: string) => void;
  disconnect: () => void;
  sendMessage: (channelId: string, message: string, user: User) => void;
  loadMessages: (channelId: string) => Promise<void>;
}

const WEBSOCKET_URL = import.meta.env.VITE_WS_SERVER_URL;
const API_URL = import.meta.env.VITE_BE_SERVER_URL;

const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set, get) => ({
      socket: new Map(),
      messages: {},
      isConnected: {},

      connect: (channelId: string) => {
        if (get().socket.has(channelId)) return;

        const ws = new WebSocket(
          `ws://${WEBSOCKET_URL.replace(/^https?:\/\//, '')}/ws/chat/${channelId}`,
        );

        ws.onopen = () => {
          set((state) => ({
            isConnected: { ...state.isConnected, [channelId]: true },
          }));
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBE',
              channelId: parseInt(channelId),
              destination: `/ws/chat/${channelId}`,
            }),
          );
        };

        ws.onclose = () => {
          set((state) => ({
            isConnected: { ...state.isConnected, [channelId]: false },
          }));
          get().socket.delete(channelId);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          set((state) => ({
            messages: {
              ...state.messages,
              [channelId]: [
                ...(state.messages[channelId] || []),
                {
                  messageId: data.messageId || crypto.randomUUID(),
                  message: data.message,
                  sender: data.sender,
                  senderName: data.senderName,
                  profile_image: data.profile_image,
                  timestamp: new Date(data.timestamp || Date.now()),
                  type: data.type || 'TALK',
                },
              ],
            },
          }));
        };

        get().socket.set(channelId, ws);
      },

      disconnect: () => {
        get().socket.forEach((ws, channelId) => {
          ws.send(
            JSON.stringify({
              type: 'UNSUBSCRIBE',
              channelId: parseInt(channelId),
            }),
          );
          ws.close();
        });
        get().socket.clear();
        set({ messages: {}, isConnected: {} });
      },

      sendMessage: (channelId: string, message: string, user: User) => {
        const ws = get().socket.get(channelId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          const payload = {
            type: 'SEND',
            channelId: parseInt(channelId),
            payload: {
              channelId: parseInt(channelId),
              message,
              id: user.email, // email을 id로 전송
              username: user.username, // username 그대로 전송
              profile_image: user.profile_image,
              type: 'TALK',
            },
          };
          console.log('Sending WebSocket payload:', payload);
          ws.send(JSON.stringify(payload));
        }
      },

      loadMessages: async (channelId: string) => {
        try {
          const token = localStorage.getItem('accessToken');
          if (!token) return;

          const response = await fetch(`${API_URL}/ws/v1/channels/${channelId}/messages`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to load messages');
          }

          const messages: Message[] = await response.json();
          set((state) => ({
            messages: {
              ...state.messages,
              [channelId]: messages.map((msg) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              })),
            },
          }));
        } catch (error) {
          console.error('Failed to load messages:', error);
        }
      },
    }),
    { name: 'WebSocket-store' },
  ),
);

export default useWebSocketStore;
