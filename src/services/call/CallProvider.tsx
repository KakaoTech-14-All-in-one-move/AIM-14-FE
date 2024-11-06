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

export function CallProvider({ children }: CallProviderProps) {
  const [state, setState] = useState<CallState>({
    users: [],
    currentUser: null,
    connectionStatus: 'DISCONNECTED'
  });
  const connectionRef = useRef<CallConnection | null>(null);
  const accessToken = useAuthStore(state => state.accessToken);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (accessToken && user) {
      const connection = new CallConnection(
        (newState) => setState(newState),
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

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}