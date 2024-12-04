import React, { createContext, useContext, useEffect } from 'react';
import { CallConnection } from './socket/callConnection';
import { useAuthStore } from '@/stores/authStore';
import { MediaConnectionManager } from './MediaConnectionManager';
import { WebRTCProvider } from './webrtc/WebRTCProvider';

interface CallContextType {
  connection: CallConnection | null;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = React.useState<CallConnection | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const mediaManager = MediaConnectionManager.getInstance();

  useEffect(() => {
    if (!accessToken) return;

    const callConnection = CallConnection.getInstance(accessToken);
    setConnection(callConnection);
    mediaManager.setCallConnection(callConnection);

    const connect = async () => {
      try {
        await callConnection.connect();
      } catch (error) {
        console.error('Connection failed:', error);
      }
    };

    connect();

    return () => {
      callConnection.disconnect();
      setConnection(null);
    };
  }, [accessToken]);

  return (
    <CallContext.Provider value={{ connection }}>
      <WebRTCProvider>
        {children}
      </WebRTCProvider>
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