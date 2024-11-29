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
  resetState: () => void;
}

const initialState = {
  users: [],
  isMuted: false,
  isDeafened: false,
  speakingUsers: new Set<string>(),
};

export const useVoiceChat = create<VoiceChatStore>((set) => ({
  users: [],
  isMuted: false,
  isDeafened: false,
  speakingUsers: new Set<string>(),

  setUsers: (users) => set({ users }),

  addUser: (user) => set((state) => {
    // 이미 존재하는 사용자인지 확인
    const existingUserIndex = state.users.findIndex(
      u => u.user_id === user.user_id &&
        u.channel_id === user.channel_id &&
        u.channel_type === user.channel_type
    );

    if (existingUserIndex !== -1) {
      // 기존 사용자가 있다면 업데이트
      const updatedUsers = [...state.users];
      updatedUsers[existingUserIndex] = {
        ...updatedUsers[existingUserIndex],
        ...user
      };
      return { users: updatedUsers };
    }

    // 새로운 사용자라면 추가
    return { users: [...state.users, user] };
  }),

  removeUser: (userId) => set(state => ({
    users: state.users.filter(u => u.user_id !== userId),
    // 사용자가 제거될 때 speaking 상태도 함께 제거
    speakingUsers: new Set(
      Array.from(state.speakingUsers).filter(id => id !== userId)
    )
  })),

  updateUserStatus: (userId: string, updates: Partial<CallUserData>) =>
    set((state) => ({
      users: state.users.map((user) =>
        user.user_id === userId ? { ...user, ...updates } : user
      )
    })),

  updateUserSpeaking: (userId: string, isSpeaking: boolean) =>
    set((state) => ({
      speakingUsers: new Set(
        isSpeaking
          ? [...Array.from(state.speakingUsers), userId]
          : Array.from(state.speakingUsers).filter(id => id !== userId)
      )
    })),

  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

  toggleDeafen: () => set(state => ({ isDeafened: !state.isDeafened })),

  resetState: () => {
    set(initialState);
  },
}));