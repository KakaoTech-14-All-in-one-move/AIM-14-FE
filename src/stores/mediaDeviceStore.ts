import { create } from 'zustand';

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface MediaDeviceState {
  devices: {
    audioInput: MediaDeviceInfo[];
    audioOutput: MediaDeviceInfo[];
    videoInput: MediaDeviceInfo[];
  };
  selectedDevices: {
    audioInputId: string | null;
    audioOutputId: string | null;
    videoInputId: string | null;
  };

  // Actions
  setDevices: (devices: {
    audioInput?: MediaDeviceInfo[];
    audioOutput?: MediaDeviceInfo[];
    videoInput?: MediaDeviceInfo[];
  }) => void;
  setSelectedDevice: (type: 'audioInput' | 'audioOutput' | 'videoInput', deviceId: string) => void;
  resetState: () => void;
}

const initialState = {
  devices: {
    audioInput: [],
    audioOutput: [],
    videoInput: [],
  },
  selectedDevices: {
    audioInputId: null,
    audioOutputId: null,
    videoInputId: null,
  },
};

export const useMediaDeviceStore = create<MediaDeviceState>((set) => ({
  ...initialState,

  setDevices: (devices) => set(state => ({
    devices: {
      ...state.devices,
      ...devices,
    },
  })),

  setSelectedDevice: (type, deviceId) => set(state => ({
    selectedDevices: {
      ...state.selectedDevices,
      [`${type}Id`]: deviceId,
    },
  })),

  resetState: () => set(initialState),
}));