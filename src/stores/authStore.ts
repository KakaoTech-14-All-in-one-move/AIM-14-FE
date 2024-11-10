import { create } from 'zustand';

interface User {
  email: string;
  username: string;
  profile_image: string;
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

const BASE_URL = 'http://localhost:8080';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setTokens: (accessToken, refreshToken) => {
    console.log('Setting tokens:', { accessToken, refreshToken });
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
    console.log('localStorage after setting tokens:', {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
    });
  },

  setUser: (user) => {
    console.log('Setting user:', user);
    // 프로필 이미지 URL에 BASE_URL 추가
    const updatedUser = {
      ...user,
      profile_image: user.profile_image
        ? user.profile_image.startsWith('http')
          ? user.profile_image
          : `${BASE_URL}${user.profile_image}`
        : '',
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  setProfileImage: (profileImageUrl: string) => {
    set((state) => {
      if (!state.user) return state;

      const updatedUser = {
        ...state.user,
        profile_image: profileImageUrl.startsWith('http')
          ? profileImageUrl
          : `${BASE_URL}${profileImageUrl}`,
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
