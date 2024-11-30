import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CallConnection } from '@/services/call/callConnection';
import { CallState, CallUserData, MediaChannelType, VoiceStateUpdate } from '@/services/call/types';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { WebRTCProvider } from '@/services/call/webrtc/WebRTCProvider.tsx';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection.ts';

interface CallContextType {
  connection: CallConnection | null;
  currentUser: CallUserData | null;
  isConnected: boolean;
  connectionStatus: string;
  joinChannel: (channelId: string, type: MediaChannelType) => void;
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
  const [state, setState] = useState<CallState>({
    users: [],
    currentUser: null,
    connectionStatus: 'DISCONNECTED',
  });

  useEffect(() => {
    console.log('CallProvider state updated:', state);
  }, [state]);

  const connectionRef = useRef<CallConnection | null>(null);
  const accessToken = useAuthStore((state: { accessToken: any; }) => state.accessToken);
  const user = useAuthStore((state: { user: any; }) => state.user);

  const handleStateUpdate = useCallback((newState: CallState) => {

    setState(prevState => {
      const existingUserMap = new Map(
        prevState.users.map(user => [user.user_id, user])
      );

      const updatedUsers = newState.users.map(newUser => {
        const existingUser = existingUserMap.get(newUser.user_id);
        return {
          ...newUser,
          profile_image: existingUser?.profile_image || newUser.profile_image,
          screen_sharing: existingUser?.screen_sharing ?? false,  // Preserve screen sharing state
        };
      });

      const updatedCurrentUser = newState.currentUser
        ? {
          ...newState.currentUser,
          profile_image:
            prevState.currentUser?.profile_image ||
            newState.currentUser.profile_image,
          screen_sharing: prevState.currentUser?.screen_sharing ?? false,  // Preserve screen sharing state
        }
        : null;

      return {
        ...prevState,
        users: updatedUsers,
        currentUser: updatedCurrentUser,
        connectionStatus: newState.connectionStatus,
      };
    });
  }, []);

  useEffect(() => {
    if (state.users.length >= 0) {
      const currentStoreUsers = useVoiceChat.getState().users;
      console.log('Syncing users with VoiceChat store:', {
        callUsers: state.users,
        voiceChatUsers: currentStoreUsers
      });

      const updatedUsers = state.users.map(newUser => {
        const existingUser = currentStoreUsers.find(u => u.user_id === newUser.user_id);
        return {
          ...newUser,
          stream: existingUser?.stream,
          screen_sharing: existingUser?.screen_sharing ?? false
        };
      });

      useVoiceChat.getState().setUsers(updatedUsers);
    }
  }, [state.users]);

  useEffect(() => {
    if (!accessToken || !user) return;

    const connection = new CallConnection(handleStateUpdate, accessToken);
    connectionRef.current = connection;

    try {
      const connectAndJoinChannel = async () => {
        try {
          await connection.connect();

          const pathSegments = window.location.pathname.split('/');
          const channelType = pathSegments[1] as 'voice' | 'video';
          const channelId = pathSegments[2];

          if (channelType && channelId && ['voice', 'video'].includes(channelType)) {
            const joinSuccess = await connection.joinChannel(
              channelId,
              channelType.toUpperCase() as MediaChannelType
            );

            if (!joinSuccess) {
              console.error('Failed to join channel');
              return;
            }

            const currentUsers = useVoiceChat.getState().users;
            const channelUsers = currentUsers.filter(user =>
              user.channel_id === channelId &&
              user.channel_type === channelType.toUpperCase()
            );

            const webrtc = WebRTCConnection.getInstance();
            if (channelUsers.length === 0) {
              await webrtc.initializePresenter(null);
            } else {
              await webrtc.initializeViewer(null);
            }
          }
        } catch (error) {
          console.error('Connection failed:', error);
        }
      };

      connectAndJoinChannel();

    } catch (error) {
      console.error('Connection failed:', error);
    }

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [accessToken, user, handleStateUpdate]);

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.leaveChannel();
        useVoiceChat.getState().resetState();
      }
    };
  }, []);

  useEffect(() => {
    if (connectionRef.current && state.currentUser) {
      // connection 내부 상태도 업데이트
      connectionRef.current.state.currentUser = state.currentUser;
    }
  }, [state.currentUser]);

  const joinChannel = useCallback((channelId: string, type: MediaChannelType) => {
    connectionRef.current?.joinChannel(channelId, type);
  }, []);

  const leaveChannel = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.leaveChannel();
      useVoiceChat.getState().resetState();
    }
  }, []);

  const updateUserState = useCallback((state: VoiceStateUpdate) => {
    connectionRef.current?.updateState(state);
  }, []);

  const contextValue: CallContextType = {
    currentUser: state.currentUser,
    connection: connectionRef.current,
    connectionStatus: state.connectionStatus,
    isConnected: state.connectionStatus === 'CONNECTED',
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
            WS: {state.connectionStatus}
            {state.users.length > 0 && ` | Users: ${state.users.length}`}
          </div>
        )}
      </WebRTCProvider>
    </CallContext.Provider>
  );
}