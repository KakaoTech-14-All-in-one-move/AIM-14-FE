import { create } from 'zustand';
import { CallUserData } from '@/services/call/types';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface UserState {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  stream: MediaStream | null;
}

interface EnhancedCallUserData extends Omit<CallUserData, 'camera_on' | 'screen_sharing'> {
  stream: MediaStream | null;
  connectionStatus: ConnectionStatus;
  camera_on: boolean;
  screen_sharing: boolean;
}

interface VideoChatState {
  users: EnhancedCallUserData[];
  speakingUsers: Set<string>;
  userStates: Map<string, UserState>;
  currentUserId: string | null;
}

interface VideoChatStore extends VideoChatState {
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
  cameraOn: false,
  screenSharing: false,
  stream: null
};

const initialState: VideoChatState = {
  users: [],
  speakingUsers: new Set<string>(),
  userStates: new Map(),
  currentUserId: null,
};

const createEnhancedUser = (user: CallUserData, userState: UserState): EnhancedCallUserData => ({
  ...user,
  stream: userState.stream,
  connectionStatus: 'connected',
  camera_on: userState.cameraOn,
  screen_sharing: userState.screenSharing,
});

export const useVideoChat = create<VideoChatStore>((set, get) => ({
  ...initialState,

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  getCurrentUserState: () => {
    const state = get();
    return state.currentUserId ? state.userStates.get(state.currentUserId) || null : null;
  },

  setUsers: (users) => set((state) => {
    const newUserStates = new Map(state.userStates);

    users.forEach(user => {
      const currentState = newUserStates.get(user.user_id) || defaultUserState;
      newUserStates.set(user.user_id, {
        ...currentState,
        muted: user.muted ?? currentState.muted,
        deafened: user.deafened ?? currentState.deafened,
        speaking: user.speaking ?? currentState.speaking,
        cameraOn: user.camera_on ?? currentState.cameraOn,
        screenSharing: user.screen_sharing ?? currentState.screenSharing
      });
    });

    const enhancedUsers = users.map(user =>
      createEnhancedUser(user, newUserStates.get(user.user_id) || defaultUserState)
    );

    return {
      users: enhancedUsers,
      userStates: newUserStates
    };
  }),

  addUser: (user) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = newUserStates.get(user.user_id) || defaultUserState;

    const userState: UserState = {
      ...currentState,
      muted: user.muted ?? currentState.muted,
      deafened: user.deafened ?? currentState.deafened,
      speaking: user.speaking ?? currentState.speaking,
      cameraOn: user.camera_on ?? currentState.cameraOn,
      screenSharing: user.screen_sharing ?? currentState.screenSharing,
      stream: user.stream ?? currentState.stream
    };

    newUserStates.set(user.user_id, userState);

    const enhancedUser = createEnhancedUser(user, userState);
    const existingIndex = state.users.findIndex(u => u.user_id === user.user_id);
    const newUsers = existingIndex !== -1
      ? state.users.map((u, index) => index === existingIndex ? enhancedUser : u)
      : [...state.users, enhancedUser];

    return {
      users: newUsers,
      userStates: newUserStates
    };
  }),

  updateUserState: (userId, state) => set((prevState) => {
    const newUserStates = new Map(prevState.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // 새로운 상태 생성
    const updatedState = {
      ...currentState,
      ...state
    };
    newUserStates.set(userId, updatedState);

    // users 배열 업데이트
    const newUsers = prevState.users.map(user => {
      if (user.user_id === userId) {
        return createEnhancedUser(user, updatedState);
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

  updateUserStatus: (userId, updates) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    // CallUserData를 UserState로 변환
    const stateUpdates: Partial<UserState> = {
      muted: updates.muted,
      deafened: updates.deafened,
      speaking: updates.speaking,
      cameraOn: updates.camera_on,
      screenSharing: updates.screen_sharing,
      stream: updates.stream ?? currentState.stream
    };

    // undefined가 아닌 값만 업데이트
    const filteredUpdates = Object.fromEntries(
      Object.entries(stateUpdates).filter(([_, value]) => value !== undefined)
    );

    // 새로운 상태 생성
    const updatedState = {
      ...currentState,
      ...filteredUpdates
    };
    newUserStates.set(userId, updatedState);

    // users 배열 업데이트
    const newUsers = state.users.map(user => {
      if (user.user_id === userId) {
        return createEnhancedUser({ ...user, ...updates }, updatedState);
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

    const updatedState = {
      ...currentState,
      speaking: isSpeaking
    };
    newUserStates.set(userId, updatedState);

    const newUsers = state.users.map(user =>
      user.user_id === userId
        ? createEnhancedUser(user, updatedState)
        : user
    );

    const newSpeakingUsers = new Set(state.speakingUsers);
    if (isSpeaking) {
      newSpeakingUsers.add(userId);
    } else {
      newSpeakingUsers.delete(userId);
    }

    return {
      userStates: newUserStates,
      users: newUsers,
      speakingUsers: newSpeakingUsers
    };
  }),

  updateUserMedia: (userId, stream) => set((state) => {
    const newUserStates = new Map(state.userStates);
    const currentState = newUserStates.get(userId) || { ...defaultUserState };

    const updatedState = {
      ...currentState,
      stream
    };
    newUserStates.set(userId, updatedState);

    const newUsers = state.users.map(user =>
      user.user_id === userId
        ? createEnhancedUser(user, updatedState)
        : user
    );

    return {
      userStates: newUserStates,
      users: newUsers
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

  resetState: () => set(initialState)
}));