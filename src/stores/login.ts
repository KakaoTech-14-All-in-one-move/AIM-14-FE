import { create, StateCreator } from 'zustand';

interface StoreState {
  email: string;
  password: string;
  isLoggedIn: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  login: () => Promise<boolean>;
  logout: () => void;
}

const storeCreator: StateCreator<StoreState> = (set) => ({
  email: '',
  password: '',
  isLoggedIn: false,
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  login: async () => {
    const { email, password } = useStore.getState();
    console.log('Logging in with:', { email, password });
    // Simulating an API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // For demo purposes, consider any login successful
    set({ isLoggedIn: true });
    return true;
  },
  logout: () => {
    set({ isLoggedIn: false, email: '', password: '' });
  },
});

export const useStore = create<StoreState>(storeCreator);
