import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

interface VoiceChatStore {
  users: CallUserData[];
  isMuted: boolean;
  isDeafened: boolean;
  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export const useVoiceChat = create<VoiceChatStore>((set, get) => ({
  users: [],
  isMuted: false,
  isDeafened: false,

  setUsers: (users) => set({ users: users }),

  addUser: (user) => set(state => ({
    users: [...state.users, user]
  })),

  removeUser: (userId) => set(state => ({
    users: state.users.filter(u => u.user_id !== userId)
  })),

  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => {
    set((state) => ({
      users: state.users.map((user) =>
        user.user_id === userId
          ? { ...user, ...updates }
          : user
      )
    }));
  },

  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

  toggleDeafen: () => set(state => ({ isDeafened: !state.isDeafened }))
}));