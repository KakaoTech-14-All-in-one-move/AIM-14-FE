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

  setUsers: (users) => {
    console.log('VoiceChat store setUsers:', users);
    set({ users: [...users] });
  },

  addUser: (user) => {
    console.log('VoiceChat store addUser:', user);
    set(state => {
      if (state.users.some(u => u.user_id === user.user_id)) {
        return state;
      }
      return { users: [...state.users, user] };
    });
  },

  removeUser: (userId) => {
    console.log('VoiceChat store removeUser:', userId);
    set(state => ({
      users: state.users.filter(u => u.user_id !== userId)
    }));
  },

  updateUserStatus: (userId, updates) => {
    console.log('VoiceChat store updateUserStatus:', { userId, updates });
    set(state => ({
      users: state.users.map(user =>
        user.user_id === userId
          ? {
            ...user,  // 기존 상태 유지
            ...updates,  // 새로운 상태로 업데이트
            // 각 상태를 독립적으로 관리
            muted: updates.muted ?? user.muted,
            deafened: updates.deafened ?? user.deafened,
            speaking: updates.speaking ?? user.speaking,
            camera_on: updates.camera_on ?? user.camera_on,
            screen_sharing: updates.screen_sharing ?? user.screen_sharing
          }
          : user
      )
    }));
  },

  toggleMute: () => {
    console.log('VoiceChat store toggleMute');
    set(state => ({ isMuted: !state.isMuted }));
  },

  toggleDeafen: () => {
    console.log('VoiceChat store toggleDeafen');
    set(state => ({ isDeafened: !state.isDeafened }));
  }
}));