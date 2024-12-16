// src/stores/webSocketStore.ts
import { create } from 'zustand';
import { apiClient } from '@/api/apiClient';
import { Chat, WebSocketCommand } from '@/types/chat';

interface User {
  id: string;
  username: string;
  profile_image?: string;
}

interface WebSocketStore {
  sockets: Record<string, WebSocket>;
  isConnected: Record<string, boolean>;
  messages: Record<string, Chat[]>;
  connect: (channelId: string) => void;
  disconnect: (channelId?: string) => void;
  sendMessage: (channelId: string, content: string, user: any) => void;
}

const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  sockets: {},
  isConnected: {},
  messages: {},

  connect: (channelId: string) => {
    const newSocket = new WebSocket(`ws://localhost:8080/ws/chat/${channelId}`);

    newSocket.onopen = () => {
      set((state) => {
        const newSockets = { ...state.sockets };
        const newIsConnected = { ...state.isConnected };
        newSockets[channelId] = newSocket;
        newIsConnected[channelId] = true;
        return {
          sockets: newSockets,
          isConnected: newIsConnected,
        };
      });

      const subscribeCommand: WebSocketCommand = {
        type: 'SUBSCRIBE',
        channelId: Number(channelId),
      };
      newSocket.send(JSON.stringify(subscribeCommand));

      apiClient.client
        .get(`/ws/v1/channels/${Number(channelId)}/messages`)
        .then((response) => {
          console.log('Received messages:', response.data);
          const messages: Chat[] = response.data.map((msg: any) => ({
            messageId: msg.messageId || Date.now().toString(),
            channelId: msg.channelId,
            message: msg.message,
            sender: msg.sender,
            senderName: msg.senderName,
            timestamp: msg.timestamp,
            type: msg.type,
            profile_image: msg.profile_image,
          }));

          set((state) => ({
            messages: {
              ...state.messages,
              [channelId]: messages,
            },
          }));
        })
        .catch((error) => {
          console.error('Failed to fetch messages:', error.response?.data || error.message);
        });
    };

    newSocket.onmessage = (event) => {
      const wsMessage: Chat = JSON.parse(event.data);
      console.log('Received WebSocket message:', wsMessage);

      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: [...(state.messages[channelId] || []), wsMessage],
        },
      }));
    };

    newSocket.onclose = () => {
      set((state) => {
        const newSockets = { ...state.sockets };
        const newIsConnected = { ...state.isConnected };
        delete newSockets[channelId];
        newIsConnected[channelId] = false;
        return {
          sockets: newSockets,
          isConnected: newIsConnected,
        };
      });
    };
  },

  disconnect: (channelId?: string) => {
    if (channelId) {
      const socket = get().sockets[channelId];
      if (socket) {
        socket.close();
        set((state) => {
          const newSockets = { ...state.sockets };
          const newIsConnected = { ...state.isConnected };
          delete newSockets[channelId];
          newIsConnected[channelId] = false;
          return {
            sockets: newSockets,
            isConnected: newIsConnected,
          };
        });
      }
    } else {
      Object.values(get().sockets).forEach((socket) => {
        if (socket) socket.close();
      });
      set({ sockets: {}, isConnected: {}, messages: {} });
    }
  },

  sendMessage: (channelId: string, message: string, user: User) => {
    const ws = get().sockets[channelId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'SEND',
        channelId: parseInt(channelId),
        payload: {
          channelId: parseInt(channelId),
          message,
          id: user.id, // sender로 사용될 email
          username: user.username, // senderName으로 사용될 username
          profile_image: user.profile_image,
          type: 'TALK',
        },
      };
      console.log('Sending WebSocket payload:', payload);
      ws.send(JSON.stringify(payload));
    }
  },
}));

export default useWebSocketStore;
