import { create } from 'zustand';
import { Server } from '@/types/server';

interface User {
  email: string;
  username: string;
  user_id: number;
  profile_image: string;
  servers: Server[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setProfileImage: (profileImageUrl: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  setUser: (user) => {
    const updatedUser = {
      ...user,
      profile_image: user.profile_image
        ? user.profile_image.startsWith('http')
          ? user.profile_image
          : `${user.profile_image}`
        : '',
      servers: user.servers || [],
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  setProfileImage: (profileImageUrl: string) => {
    set((state) => {
      if (!state.user) return state;

      const updatedUser = {
        ...state.user,
        profile_image: profileImageUrl.startsWith('http') ? profileImageUrl : `${profileImageUrl}`,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return {
        ...state,
        user: updatedUser,
      };
    });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
