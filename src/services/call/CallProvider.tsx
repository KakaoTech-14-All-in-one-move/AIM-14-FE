import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { CallConnection } from './callConnection';
import { CallState, CallUserData } from './types';
import { useAuthStore } from '@/stores/authStore';

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

  useEffect(() => {
    if (accessToken && user) {
      const connection = new CallConnection(
        (newState) => {
          console.log('🔄 CallProvider receiving state update:', newState);
          // 상태 업데이트를 함수형으로 변경하여 이전 상태 기준으로 업데이트
          setState(prevState => {
            console.log('Previous state:', prevState);
            console.log('New state:', newState);
            return {
              ...prevState,
              users: newState.users,
              currentUser: newState.currentUser,
              connectionStatus: newState.connectionStatus
            };
          });
        },
        accessToken
      );

      connectionRef.current = connection;
      connection.connect();

      return () => {
        connection.disconnect();
        connectionRef.current = null;
      };
    }
  }, [accessToken, user]);

  // 디버깅을 위한 상태 변화 감지
  useEffect(() => {
    console.log('CallProvider state changed:', state);
  }, [state]);

  const value = {
    users: state.users,
    currentUser: state.currentUser,
    connection: connectionRef.current,
    connectionStatus: state.connectionStatus
  };

  return (
    <CallContext.Provider value={value}>
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