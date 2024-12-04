import { create } from 'zustand';
import { CallUserData } from '@/services/call/socket/types';

export interface UserState {
  // Users in current channel
  users: CallUserData[];
  currentUser: CallUserData | null;

  // Peer connections
  peerConnections: Map<string, RTCPeerConnection>;

  // Actions
  setUsers: (users: CallUserData[]) => void;
  addUser: (user: CallUserData) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<CallUserData>) => void;
  setCurrentUser: (user: CallUserData | null) => void;
  setPeerConnection: (userId: string, connection: RTCPeerConnection) => void;
  removePeerConnection: (userId: string) => void;
  resetState: () => void;
}

const initialState = {
  users: [],
  currentUser: null,
  peerConnections: new Map(),
};

export const useUserStore = create<UserState>((set, get) => ({
  ...initialState,

  setUsers: (users) => set({ users }),

  addUser: (user) => set((state) => ({
    users: [...state.users, user],
  })),

  removeUser: (userId) => set((state) => ({
    users: state.users.filter((u) => u.user_id !== userId),
  })),

  updateUser: (userId, updates) => set((state) => ({
    users: state.users.map((user) =>
      user.user_id === userId ? { ...user, ...updates } : user
    ),
    currentUser:
      state.currentUser?.user_id === userId
        ? { ...state.currentUser, ...updates }
        : state.currentUser,
  })),

  setCurrentUser: (user) => set({ currentUser: user }),

  setPeerConnection: (userId, connection) =>
    set((state) => {
      const newPeerConnections = new Map(state.peerConnections);
      newPeerConnections.set(userId, connection);
      return { peerConnections: newPeerConnections };
    }),

  removePeerConnection: (userId) =>
    set((state) => {
      const newPeerConnections = new Map(state.peerConnections);
      newPeerConnections.delete(userId);
      return { peerConnections: newPeerConnections };
    }),

  resetState: () => {
    // Close all peer connections before resetting
    const { peerConnections } = get();
    peerConnections.forEach((connection) => {
      connection.close();
    });
    set(initialState);
  },
}));