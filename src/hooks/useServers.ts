import { create } from 'zustand';

/**
 * @todo 서버에서 icon, 이름을 가져와서 추가
 */
interface ServerState {
  servers: string[];
  addServer: () => void;
  removeServer: (index: number) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: ['서버 1', '서버 2', '서버 3'],
  addServer: () =>
    set((state) => ({
      servers: [...state.servers, `서버 ${state.servers.length + 1}`],
    })),
  removeServer: (index) =>
    set((state) => ({
      servers: state.servers.filter((_, i) => i !== index),
    })),
}));
