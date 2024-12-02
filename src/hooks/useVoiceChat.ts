import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface UserState {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}

interface EnhancedCallUserData extends CallUserData {
  stream: MediaStream | null;
  connectionStatus: ConnectionStatus;
}

interface VoiceChatStore {
  users: EnhancedCallUserData[];
  speakingUsers: Set<string>;
  userStates: Map<string, UserState>;
  currentUserId: string | null;

  setCurrentUserId: (userId: string) => void;
  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<CallUserData>) => void;
  updateUserSpeaking: (userId: string, isSpeaking: boolean) => void;
  updateUserMedia: (userId: string, stream: MediaStream | null) => void;
  updateUserState: (userId: string, state: Partial<UserState>) => void;
  getCurrentUserState: () => UserState | null;
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

export const useVoiceChat = create<VoiceChatStore>((set, get) => ({
  users: [],
  speakingUsers: new Set<string>(),
  userStates: new Map(),
  currentUserId: null,

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  getCurrentUserState: () => {
    const state = get();
    return state.currentUserId ? state.userStates.get(state.currentUserId) || null : null;
  },

  setUsers: (users) => set((state) => {
    const newUserStates = new Map(state.userStates);

    users.forEach(user => {
      if (!newUserStates.has(user.user_id)) {
        newUserStates.set(user.user_id, {
          ...defaultUserState,
          muted: user.muted ?? false,
          deafened: user.deafened ?? false,
          speaking: user.speaking ?? false
        });
      } else {
        const currentState = newUserStates.get(user.user_id)!;
        newUserStates.set(user.user_id, {
          ...currentState,
          muted: user.muted ?? currentState.muted,
          deafened: user.deafened ?? currentState.deafened,
          speaking: user.speaking ?? currentState.speaking
        });
      }
    });

    return {
      users: users.map(user => ({
        ...user,
        stream: newUserStates.get(user.user_id)?.stream ?? null,
        connectionStatus: 'connected' as ConnectionStatus
      })),
      userStates: newUserStates
    };
  }),

  addUser: (user) => set((state) => {
    const newUserStates = new Map(state.userStates);

    // 새로운 사용자의 상태 초기화 또는 기존 상태 유지
    if (!newUserStates.has(user.user_id)) {
      newUserStates.set(user.user_id, {
        ...defaultUserState,
        muted: user.muted ?? false,
        deafened: user.deafened ?? false,
        speaking: user.speaking ?? false
      });
    }

    // users 배열 업데이트
    const existingIndex = state.users.findIndex(u => u.user_id === user.user_id);
    const newUsers = existingIndex !== -1
      ? state.users.map((u, index) =>
        index === existingIndex ? createEnhancedUser(user, { ...state, userStates: newUserStates }) : u
      )
      : [...state.users, createEnhancedUser(user, { ...state, userStates: newUserStates })];

    return {
      users: newUsers,
      userStates: newUserStates
    };
  }),

  removeUser: (userId) => set((state) => {
    const newUserStates = new Map(state.userStates);
    newUserStates.delete(userId);

    // users 배열과 speakingUsers에서 제거
    return {
      users: state.users.filter(u => u.user_id !== userId),
      speakingUsers: new Set(Array.from(state.speakingUsers).filter(id => id !== userId)),
      userStates: newUserStates
    };
  }),

  updateUserStatus: (userId, updates) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // UserState 관련 업데이트만 적용
    const relevantUpdates: Partial<UserState> = {
      muted: updates.muted ?? currentState.muted,
      deafened: updates.deafened ?? currentState.deafened,
      speaking: updates.speaking ?? currentState.speaking
    };

    newUserStates.set(userId, {
      ...currentState,
      ...relevantUpdates
    });

    // users 배열 업데이트
    const newUsers = state.users.map(user => {
      if (user.user_id === userId) {
        return {
          ...user,
          ...updates,
          stream: user.stream // stream은 유지
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
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // speaking 상태 업데이트
    newUserStates.set(userId, {
      ...currentState,
      speaking: isSpeaking
    });

    // speakingUsers 세트 업데이트
    const newSpeakingUsers = new Set(state.speakingUsers);
    if (isSpeaking) {
      newSpeakingUsers.add(userId);
    } else {
      newSpeakingUsers.delete(userId);
    }

    return {
      userStates: newUserStates,
      speakingUsers: newSpeakingUsers
    };
  }),

  updateUserMedia: (userId, stream) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // 스트림 업데이트
    newUserStates.set(userId, {
      ...currentState,
      stream
    });

    // users 배열의 스트림도 업데이트
    const newUsers = state.users.map(user =>
      user.user_id === userId
        ? { ...user, stream }
        : user
    );

    return {
      userStates: newUserStates,
      users: newUsers
    };
  }),

  updateUserState: (userId, state) => set((prevState) => {
    const newUserStates = new Map(prevState.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // 상태 업데이트
    newUserStates.set(userId, {
      ...currentState,
      ...state
    });

    // users 배열도 함께 업데이트
    const newUsers = prevState.users.map(user => {
      if (user.user_id === userId) {
        return {
          ...user,
          muted: state.muted ?? user.muted,
          deafened: state.deafened ?? user.deafened,
          speaking: state.speaking ?? user.speaking,
          stream: state.stream ?? user.stream
        };
      }
      return user;
    });

    // speaking 상태가 변경된 경우 speakingUsers 업데이트
    let newSpeakingUsers = prevState.speakingUsers;
    if (state.speaking !== undefined) {
      newSpeakingUsers = new Set(prevState.speakingUsers);
      if (state.speaking) {
        newSpeakingUsers.add(userId);
      } else {
        newSpeakingUsers.delete(userId);
      }
    }

    return {
      userStates: newUserStates,
      users: newUsers,
      speakingUsers: newSpeakingUsers
    };
  }),

  resetState: () => set({
    users: [],
    speakingUsers: new Set<string>(),
    userStates: new Map(),
    currentUserId: null
  })
}));