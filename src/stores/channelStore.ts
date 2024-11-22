import { create } from 'zustand';
import { Channel } from '@/types/server';
import { channelApi } from '@/api/channelApi';
import { useAuthStore } from '@/stores/authStore';

interface ChannelStore {
  addChannel: (
    serverId: number,
    channelData: {
      channelName: string;
      channelCategory: 'CHAT' | 'VOICE' | 'VIDEO';
      channelPosition: number;
    },
  ) => Promise<void>;
  updateChannelName: (channelId: number, newName: string) => Promise<void>;
  deleteChannel: (channelId: number) => Promise<void>;
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  addChannel: async (serverId, channelData) => {
    try {
      const newChannel = await channelApi.createChannel(serverId, channelData);
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
      await channelApi.updateChannelName(channelId, newName);
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
