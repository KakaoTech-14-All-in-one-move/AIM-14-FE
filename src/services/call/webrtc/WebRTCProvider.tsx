import React, { createContext, useContext, useEffect, useRef } from 'react';
import { WebRTCConnection } from './WebRTCConnection';
import { MediaDevicesManager } from './MediaDevicesManager.ts';
import { useMediaStore } from '@/stores/mediaStore';
import { useUserStore } from '@/stores/userStore';

interface WebRTCContextType {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideos: Map<string, React.RefObject<HTMLVideoElement>>;
  actions: {
    toggleAudio: (enabled: boolean) => Promise<void>;
    toggleVideo: (enabled: boolean) => Promise<void>;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => Promise<void>;
    changeAudioDevice: (deviceId: string) => Promise<void>;
    changeVideoDevice: (deviceId: string) => Promise<void>;
  };
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
}

export function WebRTCProvider({ children }: { children: React.ReactNode }) {
  const mediaStore = useMediaStore();
  const userStore = useUserStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideos = useRef<Map<string, React.RefObject<HTMLVideoElement>>>(
    new Map()
  );

  const mediaDevices = MediaDevicesManager.getInstance();
  const webrtc = WebRTCConnection.getInstance();

  useEffect(() => {
    // Initialize media devices
    mediaDevices.initialize().then(() => {
      const audioDevices = mediaDevices.getAudioInputDevices();
      const videoDevices = mediaDevices.getVideoInputDevices();

      if (audioDevices.length > 0) {
        mediaStore.setAudioInput(audioDevices[0].deviceId);
      }
      if (videoDevices.length > 0) {
        mediaStore.setVideoInput(videoDevices[0].deviceId);
      }
    });

    // Initialize WebRTC connection
    webrtc.initialize({
      onTrack: (stream, userId) => {
        const videoRef = remoteVideos.current.get(userId);
        if (videoRef?.current) {
          videoRef.current.srcObject = stream;
        }
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state changed:', state);
      },
      onError: (error) => {
        console.error('WebRTC error:', error);
      }
    });

    return () => {
      webrtc.dispose();
    };
  }, []);

  // Handle user changes
  useEffect(() => {
    const users = userStore.users;
    const currentRefs = new Set(remoteVideos.current.keys());

    // Remove refs for users who left
    currentRefs.forEach(userId => {
      if (!users.find(u => u.user_id === userId)) {
        remoteVideos.current.delete(userId);
      }
    });

    // Add refs for new users
    users.forEach(user => {
      if (!remoteVideos.current.has(user.user_id)) {
        remoteVideos.current.set(
          user.user_id,
          React.createRef<HTMLVideoElement>()
        );
      }
    });
  }, [userStore.users]);

  // Audio/Video control functions
  const toggleAudio = async (enabled: boolean) => {
    await webrtc.toggleAudio(enabled);
  };

  const toggleVideo = async (enabled: boolean) => {
    await webrtc.toggleVideo(enabled);
  };

  const startScreenShare = async () => {
    if (mediaStore.isScreenSharing) return;
    await webrtc.startScreenShare();
  };

  const stopScreenShare = async () => {
    if (!mediaStore.isScreenSharing) return;
    await webrtc.stopScreenShare();
  };

  const changeAudioDevice = async (deviceId: string) => {
    await webrtc.changeAudioDevice(deviceId);
  };

  const changeVideoDevice = async (deviceId: string) => {
    const stream = await mediaDevices.changeVideoInput(deviceId);
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    mediaStore.setVideoInput(deviceId);
  };

  const contextValue: WebRTCContextType = {
    localVideoRef,
    remoteVideos: remoteVideos.current,
    actions: {
      toggleAudio,
      toggleVideo,
      startScreenShare,
      stopScreenShare,
      changeAudioDevice,
      changeVideoDevice,
    },
  };

  return (
    <WebRTCContext.Provider value={contextValue}>
      {children}
    </WebRTCContext.Provider>
  );
}