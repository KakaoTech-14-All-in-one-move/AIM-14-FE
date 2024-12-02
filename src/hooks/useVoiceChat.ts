import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

// Enum for connection status
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Base user state interface
interface UserState {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}

// Enhanced user data with additional fields
interface EnhancedCallUserData extends CallUserData {
  stream: MediaStream | null;
  connectionStatus: ConnectionStatus;
}

// Store state interface
interface VoiceChatStore {
  users: EnhancedCallUserData[];
  speakingUsers: Set<string>;
  userStates: Map<string, UserState>;
  isMuted: boolean;
  isDeafened: boolean;

  // Actions
  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  updateUserSpeaking: (userId: string, isSpeaking: boolean) => void;
  updateUserMedia: (userId: string, stream: MediaStream | null) => void;
  updateUserState: (userId: string, state: Partial<UserState>) => void;
  resetState: () => void;
}

const defaultUserState: UserState = {
  muted: false,
  deafened: false,
  speaking: false,
  stream: null
};

const createEnhancedUser = (user: CallUserData, state: VoiceChatStore): EnhancedCallUserData => ({
  ...user,
  connectionStatus: 'connected',
  stream: state.userStates.get(user.user_id)?.stream ?? null
});

export const useVoiceChat = create<VoiceChatStore>((set) => ({
  users: [],
  speakingUsers: new Set<string>(),
  userStates: new Map(),
  isMuted: false,
  isDeafened: false,

  setUsers: (users) => set((state) => {
    // 새로운 userStates Map 생성
    const newUserStates = new Map(state.userStates);

    // 각 유저에 대해 상태 업데이트
    users.forEach(user => {
      const currentState = newUserStates.get(user.user_id) || { ...defaultUserState };
      newUserStates.set(user.user_id, {
        ...currentState,
        muted: user.muted ?? currentState.muted,
        deafened: user.deafened ?? currentState.deafened,
        speaking: user.speaking ?? currentState.speaking
      });
    });

    return {
      users: users.map(user => createEnhancedUser(user, {
        ...state,
        userStates: newUserStates
      })),
      userStates: newUserStates
    };
  }),

  addUser: (user) => set((state) => {
    const enhancedUser = createEnhancedUser(user, state);
    const existingIndex = state.users.findIndex(u => u.user_id === user.user_id);

    // users 배열 업데이트
    const newUsers = existingIndex !== -1
      ? state.users.map((u, index) => index === existingIndex ? enhancedUser : u)
      : [...state.users, enhancedUser];

    // 사용자 상태 초기화/업데이트
    const newUserStates = new Map(state.userStates);
    if (!newUserStates.has(user.user_id)) {
      newUserStates.set(user.user_id, {
        ...defaultUserState,
        muted: user.muted ?? false,
        deafened: user.deafened ?? false,
        speaking: user.speaking ?? false
      });
    }

    return {
      users: newUsers,
      userStates: newUserStates
    };
  }),

  removeUser: (userId) => set((state) => {
    const newUserStates = new Map(state.userStates);
    newUserStates.delete(userId);

    return {
      users: state.users.filter(u => u.user_id !== userId),
      speakingUsers: new Set(Array.from(state.speakingUsers).filter(id => id !== userId)),
      userStates: newUserStates
    };
  }),

  updateUserStatus: (userId, newState) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = state.userStates.get(userId) || { ...defaultUserState };
    newUserStates.set(userId, { ...currentState, ...newState });

    // users 배열도 함께 업데이트
    const newUsers = state.users.map(user => {
      if (user.user_id === userId) {
        return {
          ...user,
          ...newState,
          stream: newState.stream !== undefined ? newState.stream : user.stream
        };
      }
      return user;
    });

    return {
      userStates: newUserStates,
      users: newUsers
    };
  }),

  updateUserSpeaking: (userId, isSpeaking) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = state.userStates.get(userId) || { ...defaultUserState };
    newUserStates.set(userId, { ...currentState, speaking: isSpeaking });

    return {
      userStates: newUserStates,
      speakingUsers: new Set(
        isSpeaking
          ? [...Array.from(state.speakingUsers), userId]
          : Array.from(state.speakingUsers).filter(id => id !== userId)
      )
    };
  }),

  updateUserMedia: (userId, stream) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = state.userStates.get(userId) || { ...defaultUserState };
    newUserStates.set(userId, { ...currentState, stream });

    return {
      userStates: newUserStates,
      users: state.users.map(user =>
        user.user_id === userId
          ? { ...user, stream }
          : user
      )
    };
  }),

  updateUserState: (userId, newState) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = state.userStates.get(userId) || { ...defaultUserState };
    newUserStates.set(userId, { ...currentState, ...newState });

    return {
      userStates: newUserStates
    };
  }),

  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

  toggleDeafen: () => set(state => ({ isDeafened: !state.isDeafened })),

  resetState: () => set({
    users: [],
    speakingUsers: new Set<string>(),
    userStates: new Map(),
    isMuted: false,
    isDeafened: false,
  })
}));