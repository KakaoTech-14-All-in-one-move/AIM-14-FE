import { create } from 'zustand';
import { apiClient } from '@/api/apiClient';
import { ChatMessage, WebSocketCommand } from '@/types/chat';

interface User {
  id: string;
  username: string;
  profile_image?: string; // snake_case를 camelCase로 변경
}

interface WebSocketStore {
  sockets: Record<string, WebSocket>;
  isConnected: Record<string, boolean>;
  messages: Record<string, ChatMessage[]>;
  connect: (channelId: string) => void;
  disconnect: (channelId?: string) => void;
  sendMessage: (channelId: string, content: string, user: User) => void;
  updateUserMessages: (
    channelId: string,
    userId: string,
    username: string,
    profileImage: string,
  ) => void;
}

const API_BASE_URL = import.meta.env.VITE_BE_SERVER_URL;

const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  sockets: {},
  isConnected: {},
  messages: {},

  connect: (channelId: string) => {
    const numericChannelId = Number(channelId);
    if (isNaN(numericChannelId) || numericChannelId <= 0) {
      console.error('Invalid channel ID:', channelId);
      return;
    }

    const wsUrl = API_BASE_URL.startsWith('https://')
      ? API_BASE_URL.replace('https://', 'wss://')
      : API_BASE_URL.replace('http://', 'ws://');
    const newSocket = new WebSocket(`${wsUrl}/ws/chat/${numericChannelId}`);

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
        channelId: numericChannelId,
      };
      newSocket.send(JSON.stringify(subscribeCommand));

      apiClient.client
        .get(`/ws/v1/channels/${numericChannelId}/messages`)
        .then((response) => {
          console.log('Received messages:', response.data);
          const messages: ChatMessage[] = response.data.map((msg: any) => ({
            messageId: msg.messageId,
            channelId: msg.channelId,
            message: msg.message,
            sender: msg.sender,
            senderName: msg.senderName,
            timestamp: msg.timestamp,
            type: msg.type,
            profile_image: msg.profile_image, // snake_case를 camelCase로 변경
          }));

          set((state) => {
            const currentMessages = state.messages[channelId] || [];
            const messageMap = new Map(currentMessages.map((msg) => [msg.messageId, msg]));
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
          console.error(
            'Failed to fetch messages:',
            error.response?.data?.message || error.message,
          );
        });
    };

    newSocket.onmessage = (event) => {
      try {
        const wsMessage = JSON.parse(event.data);

        if (wsMessage.type === 'USER_UPDATE') {
          get().updateUserMessages(
            channelId,
            wsMessage.userId,
            wsMessage.username,
            wsMessage.profileImage,
          );
        } else {
          // 기존 메시지 처리 로직
          set((state) => {
            const currentMessages = state.messages[channelId] || [];
            const isDuplicate = currentMessages.some(
              (msg) => msg.messageId === wsMessage.messageId,
            );

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
            return state;
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
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
    const numericChannelId = Number(channelId);
    if (isNaN(numericChannelId) || numericChannelId <= 0) {
      console.error('Invalid channel ID:', channelId);
      return;
    }

    const ws = get().sockets[channelId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'SEND',
        channelId: numericChannelId,
        payload: {
          channelId: numericChannelId,
          message,
          id: user.id,
          type: 'TALK',
        },
      };
      console.log('Sending WebSocket payload:', payload);
      ws.send(JSON.stringify(payload));
    }
  },

  updateUserMessages: (channelId, userId, username, profileImage) => {
    set((state) => {
      const newMessages = { ...state.messages };

      if (newMessages[channelId]) {
        newMessages[channelId] = newMessages[channelId].map((msg) =>
          msg.sender === userId
            ? {
                ...msg,
                senderName: username,
                profileImage: profileImage,
              }
            : msg,
        );
      }

      return { messages: newMessages };
    });
  },
}));

export default useWebSocketStore;
