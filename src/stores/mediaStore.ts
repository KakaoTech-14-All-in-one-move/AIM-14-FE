import { create } from 'zustand';
import { MediaState, MediaType } from '@/services/call/types';

const initialState: MediaState = {
  channelId: null,
  channelType: null,
  isMuted: false,
  isDeafened: false,
  isCameraOff: true,
  isScreenSharing: false,
  speaking: false,
  currentAudioInputId: null,
  currentAudioOutputId: null,
  currentVideoInputId: null,
};

export const useMediaStore = create<MediaState & {
  setChannelInfo: (channelId: string | null, type: MediaType | null) => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setCameraOff: (off: boolean) => void;
  setScreenSharing: (sharing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setAudioInput: (deviceId: string) => void;
  setAudioOutput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
  resetState: () => void;
}>((set) => ({
  ...initialState,

  setChannelInfo: (channelId, type) => set({ channelId, channelType: type }),
  setMuted: (muted) => set({ isMuted: muted }),
  setDeafened: (deafened) => set({ isDeafened: deafened }),
  setCameraOff: (off) => set({ isCameraOff: off }),
  setScreenSharing: (sharing) => set({ isScreenSharing: sharing }),
  setSpeaking: (speaking) => set({ speaking }),
  setAudioInput: (deviceId) => set({ currentAudioInputId: deviceId }),
  setAudioOutput: (deviceId) => set({ currentAudioOutputId: deviceId }),
  setVideoInput: (deviceId) => set({ currentVideoInputId: deviceId }),
  resetState: () => set(initialState),
}));