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
      // 이미 존재하는 유저인지 확인
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
            ...user,
            ...updates,
            // 명시적으로 상태 업데이트
            muted: updates.muted ?? user.muted,
            deafened: updates.deafened ?? user.deafened,
            speaking: updates.speaking ?? user.speaking,
            camera_on: updates.camera_on ?? user.camera_on,
            screen_sharing: updates.screen_sharing ?? user.screen_sharing
          }
          : user
      )
    }));

    // isMuted와 isDeafened 상태도 함께 업데이트
    if ('muted' in updates || 'deafened' in updates) {
      set(state => ({
        isMuted: updates.muted ?? state.isMuted,
        isDeafened: updates.deafened ?? state.isDeafened
      }));
    }
  },

  toggleMute: () => {
    console.log('VoiceChat store toggleMute');
    set(state => ({ isMuted: !state.isMuted }));
  },

  toggleDeafen: () => {
    console.log('VoiceChat store toggleDeafen');
    set(state => {
      const newDeafened = !state.isDeafened;
      return {
        isDeafened: newDeafened,
        // 귀머거리 상태가 되면 자동으로 음소거도 활성화
        isMuted: newDeafened ? true : state.isMuted
      };
    });
  }
}));