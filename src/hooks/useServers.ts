import { useState } from 'react';

/**
 * @todo 서버에서 icon, 이름을 가져와서 추가
 */
export const useServers = () => {
  const [servers, setServers] = useState<string[]>(['서버 1', '서버 2', '서버 3']);

  const addServer = () => {
    const newServer = `서버 ${servers.length + 1}`;
    setServers([...servers, newServer]);
  };

  return { servers, addServer };
};
