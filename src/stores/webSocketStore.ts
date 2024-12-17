import { create } from 'zustand';
import { apiClient } from '@/api/apiClient';
import { ChatMessage, WebSocketCommand } from '@/types/chat';

interface User {
  id: string;
  username: string;
  profile_image?: string;
}

interface WebSocketStore {
  sockets: Record<string, WebSocket>;
  isConnected: Record<string, boolean>;
  messages: Record<string, ChatMessage[]>;
  connect: (channelId: string) => void;
  disconnect: (channelId?: string) => void;
  sendMessage: (channelId: string, content: string, user: User) => void;
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

          set((state) => {
            // 현재 채널의 메시지 가져오기
            const currentMessages = state.messages[channelId] || [];

            // 중복 제거를 위해 Map 사용
            const messageMap = new Map(currentMessages.map((msg) => [msg.messageId, msg]));

            // 새 메시지 추가
            messages.forEach((msg) => {
              messageMap.set(msg.messageId, msg);
            });

            return {
              messages: {
                ...state.messages,
                [channelId]: Array.from(messageMap.values()).sort(
                  (a, b) => a.timestamp - b.timestamp,
                ),
              },
            };
          });
        })
        .catch((error) => {
          console.error('Failed to fetch messages:', error.response?.data || error.message);
        });
    };

    newSocket.onmessage = (event) => {
      const wsMessage: ChatMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', wsMessage);

      set((state) => {
        // 현재 채널의 메시지 목록 가져오기
        const currentMessages = state.messages[channelId] || [];

        // messageId로 중복 체크
        const isDuplicate = currentMessages.some((msg) => msg.messageId === wsMessage.messageId);

        // 중복이 아닐 경우에만 메시지 추가
        if (!isDuplicate) {
          const newMessages = [...currentMessages, wsMessage].sort(
            (a, b) => a.timestamp - b.timestamp,
          );

          return {
            messages: {
              ...state.messages,
              [channelId]: newMessages,
            },
          };
        }

        // 중복일 경우 상태 변경 없음
        return state;
      });
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

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
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
          id: user.id,
          username: user.username,
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
