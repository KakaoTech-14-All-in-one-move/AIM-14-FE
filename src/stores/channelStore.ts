// src/stores/channelStore.ts
import { create } from 'zustand';
import { channelApi } from '@/api/channelApi';
import { useAuthStore } from '@/stores/authStore';
import { Channel } from '@/types/server';

interface ChannelStore {
  channels: Channel[];
  currentChannel: Channel | null;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  addChannel: (
    serverId: number,
    data: {
      channelName: string;
      channelCategory: 'CHAT' | 'VOICE' | 'VIDEO';
    },
  ) => Promise<void>;
  updateChannelName: (serverId: number, channelId: number, newName: string) => Promise<void>;
  deleteChannel: (serverId: number, channelId: number) => Promise<void>;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [],
  currentChannel: null,

  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channel) => set({ currentChannel: channel }),

  addChannel: async (serverId, data) => {
    try {
      const newChannel = await channelApi.createChannel(serverId, {
        channelName: data.channelName,
        channelCategory: data.channelCategory,
      });

      set((state) => ({
        channels: [...state.channels, newChannel],
      }));

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

  updateChannelName: async (serverId, channelId, newName) => {
    try {
      await channelApi.updateChannelName(serverId, channelId, newName);

      set((state) => ({
        channels: state.channels.map((channel) =>
          channel.channelId === channelId ? { ...channel, channelName: newName } : channel,
        ),
        currentChannel:
          state.currentChannel?.channelId === channelId
            ? { ...state.currentChannel, channelName: newName }
            : state.currentChannel,
      }));

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

  deleteChannel: async (serverId, channelId) => {
    try {
      await channelApi.deleteChannel(serverId, channelId);

      set((state) => ({
        channels: state.channels.filter((channel) => channel.channelId !== channelId),
        currentChannel: state.currentChannel?.channelId === channelId ? null : state.currentChannel,
      }));

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
