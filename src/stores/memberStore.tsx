import { create } from 'zustand';
import { test1, test2 } from '@/components/test';

interface MemberState {
  isRegisterOpen: boolean;
  openRegister: () => void;
  closeRegister: () => void;
}

export const useMemberStore = create<MemberState>((set) => ({
  isRegisterOpen: false,
  openRegister: () => set({ isRegisterOpen: true }),
  closeRegister: () => set({ isRegisterOpen: false }),
}));
