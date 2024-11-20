import { create } from 'zustand';
import { Server } from '@/types/server';

interface ServerStore {
  servers: Server[];
  selectedServerId: number | null;
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  removeServer: (serverId: number) => void;
  setSelectedServerId: (id: number | null) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  selectedServerId: null,
  setServers: (servers) => set({ servers }),
  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers, server],
    })),
  removeServer: (serverId) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.server_id !== serverId),
    })),
  setSelectedServerId: (id) => set({ selectedServerId: id }),
}));
