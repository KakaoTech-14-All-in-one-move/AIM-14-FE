import { create } from 'zustand';
import { channelApi } from '@/api/channelApi';
import { useAuthStore } from '@/stores/authStore';
import { Channel } from '@/types/server';

interface ChannelStore {
  addChannel: (
    serverId: number,
    data: {
      channelName: string;
      channelCategory: 'CHAT' | 'VOICE' | 'VIDEO';
    },
  ) => Promise<void>;
  updateChannelName: (channelId: number, newName: string) => Promise<void>;
  deleteChannel: (channelId: number) => Promise<void>;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  addChannel: async (serverId, data) => {
    try {
      // position은 제외하고 전송
      const newChannel = await channelApi.createChannel(serverId, {
        channelName: data.channelName,
        channelCategory: data.channelCategory,
      });

      const authStore = useAuthStore.getState();
      if (authStore.user) {
        const updatedServers = authStore.user.servers.map((server) => {
          if (server.server_id === serverId) {
            return {
              ...server,
              channels: [...(server.channels || []), newChannel],
            };
          }
          return server;
        });

        authStore.setUser({
          ...authStore.user,
          servers: updatedServers,
        });
      }
    } catch (error) {
      console.error('Failed to add channel:', error);
      throw error;
    }
  },

  updateChannelName: async (channelId, newName) => {
    try {
      const updatedChannel = await channelApi.updateChannelName(channelId, newName);
      const authStore = useAuthStore.getState();

      if (authStore.user) {
        const updatedServers = authStore.user.servers.map((server) => ({
          ...server,
          channels: server.channels?.map((channel) =>
            channel.channelId === channelId ? { ...channel, channelName: newName } : channel,
          ),
        }));

        authStore.setUser({
          ...authStore.user,
          servers: updatedServers,
        });
      }
    } catch (error) {
      console.error('Failed to update channel name:', error);
      throw error;
    }
  },

  deleteChannel: async (channelId) => {
    try {
      await channelApi.deleteChannel(channelId);
      const authStore = useAuthStore.getState();

      if (authStore.user) {
        const updatedServers = authStore.user.servers.map((server) => ({
          ...server,
          channels: server.channels?.filter((channel) => channel.channelId !== channelId),
        }));

        authStore.setUser({
          ...authStore.user,
          servers: updatedServers,
        });
      }
    } catch (error) {
      console.error('Failed to delete channel:', error);
      throw error;
    }
  },
}));
