import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { WebRTCConnection } from './WebRTCConnection';
import { useCall } from '../CallProvider';
import { MediaDevices } from './MediaDevices';
import { WebRTCState } from './types';
import { useVoiceChat } from '@/hooks/useVoiceChat.ts';

interface WebRTCContextType {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  webrtcState: WebRTCState;
  mediaState: {
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
  };
  actions: {
    startPresenting: () => Promise<void>;
    startViewing: () => Promise<void>;
    toggleAudio: (enabled: boolean) => Promise<void>;
    toggleVideo: (enabled: boolean) => Promise<void>;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => Promise<void>;
    switchAudioDevice: (deviceId: string) => Promise<void>;
    switchVideoDevice: (deviceId: string) => Promise<void>;
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
  const { connection } = useCall();
  const voiceChatStore = useVoiceChat();

  const [mediaState, setMediaState] = useState({
    isVideoOff: false,
    isScreenSharing: false
  });
  const [webrtcState, setWebrtcState] = useState<WebRTCState>({
    isConnected: false,
    isPresenter: false,
    hasMicPermission: false,
    hasCameraPermission: false,
    currentAudioInputId: null,
    currentAudioOutputId: null,
    currentVideoInputId: null
  });

  const webrtcRef = useRef<WebRTCConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaDevices = MediaDevices.getInstance();

  useEffect(() => {
    mediaDevices.initialize().then(() => {
      setWebrtcState(prev => ({
        ...prev,
        hasMicPermission: mediaDevices.getAudioInputDevices().length > 0,
        hasCameraPermission: mediaDevices.getVideoInputDevices().length > 0
      }));
    });

    mediaDevices.setOnDeviceChange(() => {
      setWebrtcState(prev => ({
        ...prev,
        hasMicPermission: mediaDevices.getAudioInputDevices().length > 0,
        hasCameraPermission: mediaDevices.getVideoInputDevices().length > 0
      }));
    });

    return () => {
      stopConnection();
    };
  }, []);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      if (webrtcRef.current && stream.getVideoTracks().length > 0) {
        await webrtcRef.current.replaceVideoTrack(stream.getVideoTracks()[0]);
        setMediaState(prev => ({ ...prev, isScreenSharing: true }));
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
    }
  };

  const stopScreenShare = async () => {
    try {
      if (webrtcRef.current) {
        const stream = await mediaDevices.changeVideoInput(webrtcState.currentVideoInputId || '');
        await webrtcRef.current.replaceVideoTrack(stream.getVideoTracks()[0]);
        setMediaState(prev => ({ ...prev, isScreenSharing: false }));
      }
    } catch (error) {
      console.error('Failed to stop screen sharing:', error);
    }
  };

  const createWebRTCConnection = () => {
    if (!connection) return;

    const webrtcInstance = WebRTCConnection.getInstance();
    webrtcInstance.initialize(connection, {
      onTrack: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onConnectionStateChange: (state) => {
        setWebrtcState(prev => ({
          ...prev,
          isConnected: state === 'connected'
        }));
      },
      onError: (error) => {
        console.error('WebRTC Error:', error);
        stopConnection();
      }
    });

    webrtcRef.current = webrtcInstance;
  };

  const startPresenting = async () => {
    createWebRTCConnection();
    setWebrtcState(prev => ({ ...prev, isPresenter: true }));
    await webrtcRef.current?.initializePresenter(localVideoRef.current);
  };

  const startViewing = async () => {
    createWebRTCConnection();
    setWebrtcState(prev => ({ ...prev, isPresenter: false }));
    await webrtcRef.current?.initializeViewer(remoteVideoRef.current);
  };

  const stopConnection = () => {
    webrtcRef.current?.dispose();
    webrtcRef.current = null;
    setWebrtcState(prev => ({
      ...prev,
      isConnected: false,
      isPresenter: false
    }));
  };

  const toggleAudio = async (enabled: boolean) => {
    await webrtcRef.current?.toggleAudio(enabled);
  };

  const toggleVideo = async (enabled: boolean) => {
    await webrtcRef.current?.toggleVideo(enabled);
  };

  const switchAudioDevice = async (deviceId: string) => {
    try {
      const stream = await mediaDevices.changeAudioInput(deviceId);
      if (webrtcRef.current) {
        await webrtcRef.current.replaceAudioTrack(stream.getAudioTracks()[0]);
      }
      setWebrtcState(prev => ({
        ...prev,
        currentAudioInputId: deviceId
      }));
    } catch (error) {
      console.error('Failed to switch audio device:', error);
    }
  };

  const switchVideoDevice = async (deviceId: string) => {
    try {
      const stream = await mediaDevices.changeVideoInput(deviceId);
      if (webrtcRef.current) {
        await webrtcRef.current.replaceVideoTrack(stream.getVideoTracks()[0]);
      }
      setWebrtcState(prev => ({
        ...prev,
        currentVideoInputId: deviceId
      }));
    } catch (error) {
      console.error('Failed to switch video device:', error);
    }
  };

  const contextValue: WebRTCContextType = {
    localVideoRef,
    remoteVideoRef,
    webrtcState,
    mediaState: {
      isMuted: voiceChatStore.isMuted,
      isVideoOff: mediaState.isVideoOff,
      isScreenSharing: mediaState.isScreenSharing
    },
    actions: {
      startPresenting,
      startViewing,
      toggleAudio,
      toggleVideo,
      startScreenShare,
      stopScreenShare,
      switchAudioDevice,
      switchVideoDevice
    }
  };

  return (
    <WebRTCContext.Provider value={contextValue}>
      {children}
    </WebRTCContext.Provider>
  );
}