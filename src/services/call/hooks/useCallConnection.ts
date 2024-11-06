// services/call/hooks/useCallConnection.ts
import { useState, useEffect, useRef } from 'react';
import { CallConnection } from '../callConnection.ts';
import { CallUserData } from '../types.ts';

export function useCallConnection(serverId: string) {
  const [users, setUsers] = useState<CallUserData[]>([]);
  const connectionRef = useRef<CallConnection | null>(null);

  useEffect(() => {
    const connection = new CallConnection((updatedUsers) => {
      setUsers(updatedUsers);
    });

    connectionRef.current = connection;
    connection.connect(serverId);

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [serverId]);

  return {
    users,
    connection: connectionRef.current
  };
}