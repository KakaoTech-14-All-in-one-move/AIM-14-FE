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
    console.log('Current store state:', currentState);

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
    console.log('Updated store state:', updatedState);

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
    console.log('Updating user status:', {
      userId,
      updates,
      currentUsers
    });

    const userIndex = currentUsers.findIndex(u => u.user_id === userId);
    let newUsers;

    if (userIndex === -1) {
      newUsers = [...currentUsers, { user_id: userId, ...updates } as CallUserData];
      console.log('Adding new user with updates:', {
        userId,
        newUser: newUsers[newUsers.length - 1]
      });
    } else {
      newUsers = [...currentUsers];
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        ...updates
      };
      console.log('Updated existing user:', {
        userId,
        updatedUser: newUsers[userIndex]
      });
    }

    set(state => ({
      ...state,
      users: newUsers
    }));

    console.log('Store state after update:', {
      users: get().users
    });
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