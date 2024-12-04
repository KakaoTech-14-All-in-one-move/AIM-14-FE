import { create } from 'zustand';
import { ChatState, MediaUserState } from '@/services/call/types.ts';

const DEFAULT_USER_STATE: MediaUserState = {
  muted: false,
  deafened: false,
  speaking: false,
  cameraOn: false,
  screenSharing: false,
  stream: null,
  screenStream: null,
};

export const useMediaChatStore = create<ChatState & {
  setCurrentUserId: (userId: string) => void;
  updateUserState: (userId: string, state: Partial<MediaUserState>) => void;
  setSpeaking: (userId: string, speaking: boolean) => void;
  setStream: (userId: string, stream: MediaStream | null, isScreenShare?: boolean) => void;
  resetState: () => void;
}>((set) => ({
  userStates: new Map(),
  speakingUsers: new Set(),
  currentUserId: null,

  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  updateUserState: (userId, state) => set((prev) => {
    const userStates = new Map(prev.userStates);
    const currentState = userStates.get(userId) || DEFAULT_USER_STATE;
    userStates.set(userId, { ...currentState, ...state });
    return { userStates };
  }),

  setSpeaking: (userId, speaking) => set((prev) => {
    const speakingUsers = new Set(prev.speakingUsers);
    if (speaking) {
      speakingUsers.add(userId);
    } else {
      speakingUsers.delete(userId);
    }
    return { speakingUsers };
  }),

  setStream: (userId, stream, isScreenShare = false) => set((prev) => {
    const userStates = new Map(prev.userStates);
    const currentState = userStates.get(userId) || DEFAULT_USER_STATE;
    if (isScreenShare) {
      userStates.set(userId, { ...currentState, screenStream: stream });
    } else {
      userStates.set(userId, { ...currentState, stream });
    }
    return { userStates };
  }),

  resetState: () => set({
    userStates: new Map(),
    speakingUsers: new Set(),
    currentUserId: null,
  }),
}));