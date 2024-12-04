import React, { createContext, useContext, useEffect, useState } from 'react';
import { CallConnection } from './socket/callConnection.ts';
import { CallUserData, MediaChannelType, VoiceStateUpdate } from './socket/types';
import { useAuthStore } from '@/stores/authStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useUserStore } from '@/stores/userStore';
import { WebRTCProvider } from './webrtc/WebRTCProvider';

interface CallContextType {
  connection: CallConnection | null;
  currentUser: CallUserData | null;
  isConnected: boolean;
  joinChannel: (channelId: string, type: MediaChannelType) => Promise<boolean>;
  leaveChannel: () => void;
  updateUserState: (state: VoiceStateUpdate) => void;
}

const CallContext = createContext<CallContextType | null>(null);

interface CallProviderProps {
  children: React.ReactNode;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export function CallProvider({ children }: CallProviderProps) {
  const [connection, setConnection] = useState<CallConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const mediaStore = useMediaStore();
  const userStore = useUserStore();

  useEffect(() => {
    if (!accessToken || !user) return;

    const callConnection = CallConnection.getInstance(accessToken);
    setConnection(callConnection);

    const connectAndJoinChannel = async () => {
      try {
        const connected = await callConnection.connect();
        setIsConnected(connected);

        if (connected) {
          const pathSegments = window.location.pathname.split('/');
          const channelType = pathSegments[1] as 'voice' | 'video';
          const channelId = pathSegments[2];

          if (channelType && channelId && ['voice', 'video'].includes(channelType)) {
            await callConnection.joinChannel(
              channelId,
              channelType.toUpperCase() as MediaChannelType
            );
          }
        }
      } catch (error) {
        console.error('Connection failed:', error);
        setIsConnected(false);
      }
    };

    connectAndJoinChannel();

    return () => {
      callConnection.disconnect();
      setConnection(null);
      setIsConnected(false);
      mediaStore.resetState();
      userStore.resetState();
    };
  }, [accessToken, user]);

  const joinChannel = async (channelId: string, type: MediaChannelType) => {
    if (!connection) return false;
    return connection.joinChannel(channelId, type);
  };

  const leaveChannel = () => {
    connection?.leaveChannel();
  };

  const updateUserState = (state: VoiceStateUpdate) => {
    connection?.updateState(state);
  };

  const contextValue: CallContextType = {
    connection,
    currentUser: userStore.currentUser,
    isConnected,
    joinChannel,
    leaveChannel,
    updateUserState,
  };

  return (
    <CallContext.Provider value={contextValue}>
      <WebRTCProvider>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-2 right-2 bg-gray-800 text-white px-3 py-1 rounded-md text-sm z-50">
            WS: {isConnected ? 'Connected' : 'Disconnected'}
            {userStore.users.length > 0 && ` | Users: ${userStore.users.length}`}
          </div>
        )}
      </WebRTCProvider>
    </CallContext.Provider>
  );
}