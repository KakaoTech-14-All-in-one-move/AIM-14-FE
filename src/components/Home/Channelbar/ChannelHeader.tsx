import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';

const ChannelHeader: React.FC = () => {
  const servers = useServerStore((state) => state.servers);
  const selectedServerId = useServerStore((state) => state.selectedServerId);

  const selectedServer = servers.find((server) => server.server_id === selectedServerId);

  return (
    <div className="flex items-center justify-between p-4 border-b-2 border-discord800">
      <span className="font-semibold">{selectedServer?.server_name || 'Home'}</span>
      <ChevronDown size={20} />
    </div>
  );
};

export default ChannelHeader;