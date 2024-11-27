import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

interface VoiceChatStore {
  users: CallUserData[];
  speakingUsers: Set<string>;
  isMuted: boolean;
  isDeafened: boolean;

  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  updateUserSpeaking: (userId: string, isSpeaking: boolean) => void;
}

export const useVoiceChat = create<VoiceChatStore>((set, _) => ({
  users: [],
  isMuted: false,
  isDeafened: false,
  speakingUsers: new Set<string>(),

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

  updateUserSpeaking: (userId: string, isSpeaking: boolean) =>
    set((state) => {
      const newSpeakingUsers = new Set(state.speakingUsers);
      if (isSpeaking) {
        newSpeakingUsers.add(userId);
      } else {
        newSpeakingUsers.delete(userId);
      }
      return { speakingUsers: newSpeakingUsers };
    }),

  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

  toggleDeafen: () => set(state => ({ isDeafened: !state.isDeafened }))
}));