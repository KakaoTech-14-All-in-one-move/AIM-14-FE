import { apiClient } from '@/api/apiClient';
import { Channel } from '@/types/server';

export const channelApi = {
  createChannel: async (
    serverId: number,
    data: {
      channelName: string;
      channelCategory: 'CHAT' | 'VOICE' | 'VIDEO';
    },
  ): Promise<Channel> => {
    const requestBody = {
      channel_name: data.channelName,
      channel_category: data.channelCategory,
    };

    const response = await apiClient.client.post(
      `/api/v1/servers/${serverId}/channels`,
      requestBody,
    );
    return response.data;
  },

  updateChannelName: async (channelId: number, channelName: string): Promise<Channel> => {
    const response = await apiClient.client.put(`/api/v1/channels/${channelId}/name`, {
      channelName,
    });
    return response.data;
  },

  deleteChannel: async (channelId: number): Promise<void> => {
    await apiClient.client.delete(`/api/v1/channels/${channelId}`);
  },

  getServerChannels: async (serverId: number): Promise<Channel[]> => {
    const response = await apiClient.client.get(`/api/v1/servers/${serverId}/channels`);
    return response.data;
  },
};
