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
  const connectionRef = useRef<CallConnection | null>(null);
  const accessToken = useAuthStore((state: { accessToken: any; }) => state.accessToken);
  const user = useAuthStore((state: { user: any; }) => state.user);

  const handleStateUpdate = useCallback((newState: CallState) => {
    setState(prevState => {
      const existingUserMap = new Map(
        prevState.users.map(user => [user.user_id, user]),
      );

      const updatedUsers = newState.users.map(newUser => {
        const existingUser = existingUserMap.get(newUser.user_id);
        return {
          ...newUser,
          profile_image: existingUser?.profile_image || newUser.profile_image,
        };
      });

      const updatedCurrentUser = newState.currentUser
        ? {
          ...newState.currentUser,
          profile_image:
            prevState.currentUser?.profile_image ||
            newState.currentUser.profile_image,
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
      const updatedUsers = state.users.map(newUser => {
        const existingUser = currentStoreUsers.find(u => u.user_id === newUser.user_id);
        return existingUser?.stream
          ? { ...newUser, stream: existingUser.stream }
          : newUser;
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
        await connection.connect();

        // 현재 URL에서 채널 정보 파싱
        const pathSegments = window.location.pathname.split('/');
        const channelType = pathSegments[1] as 'voice' | 'video';
        const channelId = pathSegments[2];

        // 유효한 채널 경로인 경우에만 재연결
        if (channelType && channelId && ['voice', 'video'].includes(channelType)) {
          // 연결 상태 확인
          await new Promise<void>((resolve) => {
            const checkConnection = () => {
              if (connection.isConnected()) {
                resolve();
              } else {
                setTimeout(checkConnection, 100);
              }
            };
            checkConnection();
          });

          // 채널 입장
          connection.joinChannel(channelId, channelType.toUpperCase() as MediaChannelType);

          // 현재 채널 사용자 수 확인하여 presenter/viewer 결정
          const currentUsers = useVoiceChat.getState().users;
          const channelUsers = currentUsers.filter(user =>
            user.channel_id === channelId &&
            user.channel_type === channelType.toUpperCase(),
          );

          // WebRTC 연결 설정
          const webrtc = WebRTCConnection.getInstance();
          if (channelUsers.length === 0) {
            await webrtc.initializePresenter(null);
          } else {
            await webrtc.initializeViewer(null);
          }
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
      // CallProvider가 언마운트될 때 정리
      if (connectionRef.current) {
        connectionRef.current.leaveChannel();
        useVoiceChat.getState().resetState();
      }
    };
  }, []);

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