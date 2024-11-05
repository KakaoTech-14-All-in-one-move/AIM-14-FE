import { create } from 'zustand';

interface User {
  id: string;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  imageUrl?: string;
}

interface VoiceChatStore {
  users: User[];
  isMuted: boolean;
  isDeafened: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  updateCurrentUserStatus: () => void;
}

export const useVoiceChat = create<VoiceChatStore>((set) => ({
  users: [
    {
      id: '1',
      nickname: '이정진',
      isSpeaking: false,
      isMuted: false,
      isDeafened: false
    }
  ],
  isMuted: false,
  isDeafened: false,
  toggleMute: () => set((state) => {
    const newMutedState = !state.isMuted;
    const updatedUsers = state.users.map(user =>
      user.id === '1' ? { ...user, isMuted: newMutedState } : user
    );
    return {
      isMuted: newMutedState,
      users: updatedUsers
    };
  }),
  toggleDeafen: () => set((state) => {
    const newDeafenedState = !state.isDeafened;
    const updatedUsers = state.users.map(user =>
      user.id === '1' ? { ...user, isDeafened: newDeafenedState } : user
    );
    return {
      isDeafened: newDeafenedState,
      users: updatedUsers
    };
  }),
  updateCurrentUserStatus: () => set((state) => ({
    users: state.users.map(user =>
      user.id === '1'
        ? { ...user, isMuted: state.isMuted, isDeafened: state.isDeafened }
        : user
    )
  }))
}));