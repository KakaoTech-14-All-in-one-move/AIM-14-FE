import { create } from 'zustand';
import { MediaType } from '@/services/call/types';

export interface MediaState {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
}

export interface ChannelUser {
  userId: string;
  username: string;
  profileImage?: string;
  channelId: string;
  mediaState: MediaState;
}

interface UserChannelState {
  // 채널별 사용자 목록
  channelUsers: Map<string, ChannelUser[]>;
  // 현재 사용자의 채널 정보
  currentUserChannel: {
    channelId: string | null;
    channelType: MediaType | null;
  };

  // Actions
  setChannelUsers: (channelId: string, users: ChannelUser[]) => void;
  addChannelUser: (channelId: string, user: ChannelUser) => void;
  removeChannelUser: (channelId: string, userId: string) => void;
  updateUserMediaState: (channelId: string, userId: string, mediaState: Partial<MediaState>) => void;
  setCurrentUserChannel: (channelId: string | null, channelType: MediaType | null) => void;
  resetChannel: (channelId: string) => void;
  resetAllState: () => void;
}

const initialState = {
  channelUsers: new Map(),
  currentUserChannel: {
    channelId: null,
    channelType: null,
  },
};

export const useUserChannelStore = create<UserChannelState>((set) => ({
  ...initialState,

  setChannelUsers: (channelId, users) => set(state => {
    const newChannelUsers = new Map(state.channelUsers);
    newChannelUsers.set(channelId, users);
    return { channelUsers: newChannelUsers };
  }),

  addChannelUser: (channelId, user) => set(state => {
    const newChannelUsers = new Map(state.channelUsers);
    const currentUsers = newChannelUsers.get(channelId) || [];
    if (!currentUsers.find(u => u.userId === user.userId)) {
      newChannelUsers.set(channelId, [...currentUsers, user]);
    }
    return { channelUsers: newChannelUsers };
  }),

  removeChannelUser: (channelId, userId) => set(state => {
    const newChannelUsers = new Map(state.channelUsers);
    const currentUsers = newChannelUsers.get(channelId) || [];
    newChannelUsers.set(
      channelId,
      currentUsers.filter(u => u.userId !== userId)
    );
    return { channelUsers: newChannelUsers };
  }),

  updateUserMediaState: (channelId, userId, mediaState) => set(state => {
    const newChannelUsers = new Map(state.channelUsers);
    const currentUsers = newChannelUsers.get(channelId) || [];
    const updatedUsers = currentUsers.map(user =>
      user.userId === userId
        ? { ...user, mediaState: { ...user.mediaState, ...mediaState } }
        : user
    );
    newChannelUsers.set(channelId, updatedUsers);
    return { channelUsers: newChannelUsers };
  }),

  setCurrentUserChannel: (channelId, channelType) => set({
    currentUserChannel: { channelId, channelType }
  }),

  resetChannel: (channelId) => set(state => {
    const newChannelUsers = new Map(state.channelUsers);
    newChannelUsers.delete(channelId);
    return { channelUsers: newChannelUsers };
  }),

  resetAllState: () => set(initialState),
}));