import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CallConnection } from './callConnection';
import { CallState, CallUserData } from './types';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface CallContextType {
  users: CallUserData[];
  currentUser: CallUserData | null;
  connection: CallConnection | null;
  connectionStatus: string;
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
    connectionStatus: 'DISCONNECTED'
  });
  const connectionRef = useRef<CallConnection | null>(null);
  const accessToken = useAuthStore((state: { accessToken: any; }) => state.accessToken);
  const user = useAuthStore((state: { user: any; }) => state.user);

  const handleStateUpdate = useCallback((newState: CallState) => {
    console.log('CallProvider received state update:', newState);

    setState(prevState => {
      console.log('Previous state:', prevState);

      const updatedState = {
        ...prevState,
        users: newState.users,
        currentUser: newState.currentUser,
        connectionStatus: newState.connectionStatus
      };

      console.log('Updated state:', updatedState);
      return updatedState;
    });
  }, []);

  // VoiceChat 스토어와 동기화
  useEffect(() => {
    if (state.users.length >= 0) {  // 0 이상으로 변경하여 빈 배열도 동기화
      console.log('Syncing users with VoiceChat store:', state.users);
      useVoiceChat.getState().setUsers(state.users);
    }
  }, [state.users]);

  // WebSocket 연결 설정
  useEffect(() => {
    if (!accessToken || !user) return;

    const connection = new CallConnection(handleStateUpdate, accessToken);
    connectionRef.current = connection;

    // 연결 시작
    try {
      connection.connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }

    // 클린업
    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [accessToken, user, handleStateUpdate]);

  // 개발 환경에서 상태 변화 모니터링
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('CallProvider State Update');
      console.log('Users:', state.users);
      console.log('Current User:', state.currentUser);
      console.log('Connection Status:', state.connectionStatus);
      console.groupEnd();
    }
  }, [state]);

  const contextValue = {
    users: state.users,
    currentUser: state.currentUser,
    connection: connectionRef.current,
    connectionStatus: state.connectionStatus
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-2 right-2 bg-gray-800 text-white px-3 py-1 rounded-md text-sm z-50">
          WS: {state.connectionStatus}
          {state.users.length > 0 && ` | Users: ${state.users.length}`}
        </div>
      )}
    </CallContext.Provider>
  );
}