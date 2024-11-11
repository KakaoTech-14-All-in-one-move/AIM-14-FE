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
    console.log('VoiceChat store setUsers - 이전:', get().users);
    console.log('VoiceChat store setUsers - 새로운 users:', users);

    // 기존 사용자들의 stream 정보 보존
    const existingUsers = get().users;
    const updatedUsers = users.map(newUser => {
      const existingUser = existingUsers.find(u => u.user_id === newUser.user_id);
      return {
        ...newUser,
        stream: existingUser?.stream || newUser.stream
      };
    });

    console.log('VoiceChat store setUsers - 업데이트된 users:', updatedUsers);
    set({ users: updatedUsers });
  },

  addUser: (user) => {
    console.log('VoiceChat store addUser - 이전:', get().users);
    console.log('VoiceChat store addUser - 추가할 user:', user);

    set(state => {
      // 이미 존재하는 사용자인지 확인
      if (state.users.some(u => u.user_id === user.user_id)) {
        console.log('VoiceChat store addUser - 이미 존재하는 사용자');
        return state;
      }

      const updatedUsers = [...state.users, user];
      console.log('VoiceChat store addUser - 업데이트된 users:', updatedUsers);
      return { users: updatedUsers };
    });
  },

  removeUser: (userId) => {
    console.log('VoiceChat store removeUser - 이전:', get().users);
    console.log('VoiceChat store removeUser - 제거할 userId:', userId);

    set(state => {
      const updatedUsers = state.users.filter(u => u.user_id !== userId);
      console.log('VoiceChat store removeUser - 업데이트된 users:', updatedUsers);
      return { users: updatedUsers };
    });
  },

  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => {
    console.log('VoiceChat store updateUserStatus - 이전 상태:', {
      userId,
      updates,
      currentUsers: get().users
    });

    set((state) => {
      const updatedUsers = state.users.map((user) => {
        if (user.user_id === userId) {
          // 기존 사용자의 모든 필드를 유지하면서 업데이트
          const updatedUser = {
            ...user,
            ...updates,
            // 명시적으로 각 필드 업데이트 (undefined 방지)
            muted: updates.muted ?? user.muted,
            deafened: updates.deafened ?? user.deafened,
            speaking: updates.speaking ?? user.speaking,
            camera_on: updates.camera_on ?? user.camera_on,
            screen_sharing: updates.screen_sharing ?? user.screen_sharing,
          };

          // stream이 제공된 경우에만 업데이트
          if (updates.stream !== undefined) {
            console.log('스트림 업데이트:', {
              userId,
              hasStream: !!updates.stream,
              streamTracks: updates.stream?.getTracks()
            });
            updatedUser.stream = updates.stream;
          }

          // 프로필 이미지가 제공된 경우에만 업데이트
          if (updates.profile_image) {
            updatedUser.profile_image = updates.profile_image;
          }

          console.log('사용자 상태 업데이트:', {
            before: user,
            after: updatedUser
          });

          return updatedUser;
        }
        return user;
      });

      console.log('VoiceChat store updateUserStatus - 업데이트된 상태:', updatedUsers);
      return { users: updatedUsers };
    });
  },

  toggleMute: () => {
    console.log('VoiceChat store toggleMute - 이전:', get().isMuted);
    set(state => {
      const newState = { isMuted: !state.isMuted };
      console.log('VoiceChat store toggleMute - 이후:', newState);
      return newState;
    });
  },

  toggleDeafen: () => {
    console.log('VoiceChat store toggleDeafen - 이전:', get().isDeafened);
    set(state => {
      const newState = { isDeafened: !state.isDeafened };
      console.log('VoiceChat store toggleDeafen - 이후:', newState);
      return newState;
    });
  }
}));