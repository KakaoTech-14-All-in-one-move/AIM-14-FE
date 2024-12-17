import { create } from 'zustand';
import { ChatMessage } from '@/types/chat';
import { apiClient } from '@/api/apiClient';
import { useAuthStore } from '@/stores/authStore';
import useWebSocketStore from '@/stores/webSocketStore';

interface MessageState {
  messages: Record<string, ChatMessage[]>;
  currentChannelId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface MessageActions {
  setCurrentChannelId: (channelId: string | null) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  addWebSocketMessage: (channelId: string, message: any) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  clearChannelMessages: (channelId: string) => void;
  sendMessage: (channelId: string, content: string) => void;
}

const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  messages: {},
  currentChannelId: null,
  isLoading: false,
  error: null,

  setCurrentChannelId: (channelId) => {
    console.log('Setting current channel ID:', channelId);
    set({ currentChannelId: channelId });
    if (channelId && !get().messages[channelId]) {
      console.log('Fetching messages for channel:', channelId);
      get().fetchMessages(channelId);
    }
  },

  addMessage: (channelId, message) => {
    console.log('Adding message to channel:', channelId);
    console.log('Message:', message);
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] || []), message],
      },
    }));
  },

  addWebSocketMessage: (channelId, wsMessage) => {
    console.log('Adding WebSocket message:', wsMessage);
    const message: ChatMessage = {
      messageId: wsMessage.id || Date.now().toString(),
      channelId: channelId,
      timestamp: Date.now(),
      type: 'TALK',
      sender: wsMessage.author,
      senderName: wsMessage.author,
      message: wsMessage.content,
      profile_image: wsMessage.profileImage,
    };

    get().addMessage(channelId, message);
  },

  fetchMessages: async (channelId) => {
    if (!channelId) return;

    console.log('Fetching messages for channel:', channelId);
    set({ isLoading: true, error: null });
    try {
      console.log(
        'Request URL:',
        `${apiClient.client.defaults.baseURL}/ws/v1/channels/${channelId}/messages`,
      );
      console.log('Request headers:', apiClient.client.defaults.headers);

      const response = await apiClient.client.get(`/ws/v1/channels/${channelId}/messages`);
      console.log('Fetched messages:', response.data);
      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: response.data,
        },
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      }
      set({ error: 'Failed to fetch messages', isLoading: false });
    }
  },

  clearChannelMessages: (channelId) => {
    console.log('Clearing messages for channel:', channelId);
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[channelId];
      return { messages: newMessages };
    });
    useWebSocketStore.getState().disconnect();
  },

  sendMessage: (channelId, content) => {
    console.log('Sending message to channel:', channelId);
    console.log('Content:', content);

    const user = useAuthStore.getState().user;
    if (!user) {
      console.warn('No user found, cannot send message');
      return;
    }

    const tempMessage: ChatMessage = {
      messageId: Date.now().toString(),
      channelId: channelId,
      timestamp: Date.now(),
      type: 'TALK',
      sender: user.username,
      senderName: user.username,
      message: content,
      profile_image: user.profile_image,
    };

    get().addMessage(channelId, tempMessage);

    apiClient.client
      .post(`/ws/v1/channels/${channelId}/messages`, {
        content,
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
      });
  },
}));

export default useMessageStore;
