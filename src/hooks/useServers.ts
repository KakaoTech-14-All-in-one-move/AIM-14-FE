import { useState } from 'react';

export const useServers = () => {
  const [servers, setServers] = useState<string[]>(['서버 1', '서버 2', '서버 3']);

  const addServer = () => {
    const newServer = `서버 ${servers.length + 1}`;
    setServers([...servers, newServer]);
  };

  return { servers, addServer };
};
