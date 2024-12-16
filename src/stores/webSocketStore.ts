// src/stores/webSocketStore.ts
import { create } from 'zustand';
import { apiClient } from '@/api/apiClient';
import { ChatMessage, WebSocketCommand } from '@/types/chat';

interface WebSocketStore {
  sockets: Record<string, WebSocket>;
  isConnected: Record<string, boolean>;
  messages: Record<string, ChatMessage[]>;
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
          const messages: ChatMessage[] = response.data.map((msg: any) => ({
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
      const wsMessage: ChatMessage = JSON.parse(event.data);
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

  sendMessage: (channelId: string, message: string, user: any) => {
    const ws = get().sockets[channelId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', { user, message }); // 디버깅용 로그 추가
      ws.send(
        JSON.stringify({
          type: 'SEND',
          channelId: parseInt(channelId),
          payload: {
            channelId: parseInt(channelId),
            message,
            sender: user.email, // id 대신 email 사용
            senderName: user.username,
            profile_image: user.profile_image,
            type: 'TALK',
          },
        }),
      );
    }
  },
}));

export default useWebSocketStore;
