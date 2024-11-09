// useVoiceChat.ts를 수정
import { CallUserData } from '@/services/call/types';
import { create } from 'zustand';

interface VoiceChatStore {
  users: CallUserData[];
  isMuted: boolean;
  isDeafened: boolean;
  setUsers: (users: CallUserData[]) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
}

export const useVoiceChat = create<VoiceChatStore>((set) => ({
  users: [],
  isMuted: false,
  isDeafened: false,
  setUsers: (users) => set({ users }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),
  updateUserStatus: (userId, updates) => set((state) => ({
    users: state.users.map(user =>
      user.user_id === userId ? { ...user, ...updates } : user
    )
  }))
}));