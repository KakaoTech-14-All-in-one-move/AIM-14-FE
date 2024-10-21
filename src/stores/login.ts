import { create, StateCreator } from 'zustand';

interface StoreState {
  email: string;
  username: string;
  password: string;
  isLoggedIn: boolean;
  profileImage: string;
  userColors: { [key: string]: string };
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  login: () => Promise<boolean>;
  logout: () => void;
  setUserColor: (username: string, color: string) => void;
}

const storeCreator: StateCreator<StoreState> = (set) => ({
  email: '',
  username: 'teddy.kim(김영진)',
  password: '',
  isLoggedIn: false,
  profileImage: '/kakao_login_logo.png',
  userColors: {},
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  login: async () => {
    const { email, password } = useStore.getState();
    console.log('Logging in with:', { email, password });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    set({ isLoggedIn: true });
    return true;
  },
  logout: () => {
    set({ isLoggedIn: false, email: '', password: '' });
  },
  setUserColor: (username, color) =>
    set((state) => ({
      userColors: { ...state.userColors, [username]: color },
    })),
});

export const useStore = create<StoreState>(storeCreator);
