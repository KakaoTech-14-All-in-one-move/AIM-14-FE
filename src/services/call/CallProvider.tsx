import React, { createContext, useContext, useEffect, useState } from 'react';
import { CallConnection } from './socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { MediaConnectionManager } from './MediaConnectionManager';
import { useMediaDeviceStore } from '@/stores/mediaDeviceStore';

interface CallContextType {
  connection: CallConnection | null;
  isConnected: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<CallConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const mediaManager = MediaConnectionManager.getInstance();

  useEffect(() => {
    if (!accessToken) return;

    const callConnection = CallConnection.getInstance(accessToken);
    setConnection(callConnection);
    mediaManager.setCallConnection(callConnection);

    const connect = async () => {
      try {
        const connected = await callConnection.connect();
        setIsConnected(connected);
      } catch (error) {
        console.error('Connection failed:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      callConnection.disconnect();
      setConnection(null);
      setIsConnected(false);
    };
  }, [accessToken]);

  useEffect(() => {
    const setupDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mediaDeviceStore = useMediaDeviceStore.getState();

        const audioInputs = devices.filter(device => device.kind === 'audioinput')
          .map(device => ({ deviceId: device.deviceId, label: device.label }));
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
          .map(device => ({ deviceId: device.deviceId, label: device.label }));
        const videoInputs = devices.filter(device => device.kind === 'videoinput')
          .map(device => ({ deviceId: device.deviceId, label: device.label }));

        mediaDeviceStore.setDevices({
          audioInput: audioInputs,
          audioOutput: audioOutputs,
          videoInput: videoInputs,
        });

        // 초기 장치 설정
        if (audioInputs.length > 0) {
          mediaDeviceStore.setSelectedDevice('audioInput', audioInputs[0].deviceId);
        }
        if (audioOutputs.length > 0) {
          mediaDeviceStore.setSelectedDevice('audioOutput', audioOutputs[0].deviceId);
        }
        if (videoInputs.length > 0) {
          mediaDeviceStore.setSelectedDevice('videoInput', videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to setup media devices:', error);
      }
    };

    setupDevices();

    // 장치 변경 감지
    navigator.mediaDevices.addEventListener('devicechange', setupDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', setupDevices);
    };
  }, []);

  return (
    <CallContext.Provider value={{ connection, isConnected }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}