import { create } from 'zustand';

interface RecordingState {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  startRecording: () => set({ isRecording: true }),
  stopRecording: () => set({ isRecording: false }),
}));
