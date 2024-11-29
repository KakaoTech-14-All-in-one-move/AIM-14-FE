import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

interface VideoChatStore {
  users: CallUserData[];
  isSpeaking: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  speakingUsers: Set<string>;

  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  updateUserSpeaking: (userId: string, isSpeaking: boolean) => void;
  resetState: () => void;
}

const initialState = {
  users: [],
  isSpeaking: false,
  isCameraOn: false,
  isScreenSharing: false,
  isMuted: false,
  isDeafened: false,
  speakingUsers: new Set<string>(),
};

export const useVideoChat = create<VideoChatStore>((set, get) => ({
  ...initialState,

  setUsers: (users) => set({ users }),

  addUser: (user) => {
    const currentState = get();

    const existingUserIndex = currentState.users.findIndex(
      u => u.user_id === user.user_id
    );

    let newUsers;
    if (existingUserIndex !== -1) {
      newUsers = [...currentState.users];
      newUsers[existingUserIndex] = {
        ...newUsers[existingUserIndex],
        ...user
      };
    } else {
      newUsers = [...currentState.users, user];
    }

    // 상태 업데이트를 한 번에 처리
    set({
      ...currentState,
      users: newUsers
    });

    // 업데이트 확인
    const updatedState = get();

    return updatedState;
  },

  removeUser: (userId) => set(state => ({
    ...state,
    users: state.users.filter(u => u.user_id !== userId),
    speakingUsers: new Set(
      Array.from(state.speakingUsers).filter(id => id !== userId)
    )
  })),

  updateUserStatus: (userId, updates) => {
    const currentUsers = get().users;

    const userIndex = currentUsers.findIndex(u => u.user_id === userId);
    let newUsers;

    if (userIndex === -1) {
      newUsers = [...currentUsers, { user_id: userId, ...updates } as CallUserData];
    } else {
      newUsers = [...currentUsers];
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        ...updates
      };
    }

    set(state => ({
      ...state,
      users: newUsers
    }));
  },

  toggleCamera: () => set(state => ({ ...state, isCameraOn: !state.isCameraOn })),
  toggleScreenShare: () => set(state => ({ ...state, isScreenSharing: !state.isScreenSharing })),
  toggleMute: () => set(state => ({ ...state, isMuted: !state.isMuted })),
  toggleDeafen: () => set(state => ({ ...state, isDeafened: !state.isDeafened })),

  updateUserSpeaking: (userId, isSpeaking) => set(state => {
    const newSpeakingUsers = new Set(state.speakingUsers);
    if (isSpeaking) {
      newSpeakingUsers.add(userId);
    } else {
      newSpeakingUsers.delete(userId);
    }
    return { ...state, speakingUsers: newSpeakingUsers };
  }),

  resetState: () => {
    set(initialState);
  },
}));