import React, { useState } from 'react';
import { SidebarIcon } from '@/components/Home/Sidebar/SidebarIcon';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/apiClient';

const Sidebar: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

  const handleAddServer = async () => {
    try {
      const name = prompt('서버 이름을 입력하세요:');
      if (!name || !user) return;

      const response = await apiClient.client.post('/api/v1/servers', {
        server_name: name
      });
      const newServer = response.data;

      setUser({
        ...user,
        servers: [...(user.servers || []), newServer]
      });

      setSelectedServerId(newServer.server_id);
    } catch (err) {
      console.error('서버 생성 실패:', err);
      alert('서버 생성에 실패했습니다.');
    }
  };

  const handleRemoveServer = async (serverId: number) => {
    try {
      if (!user) return;

      await apiClient.client.delete(`/api/v1/servers/${serverId}`);

      setUser({
        ...user,
        servers: user.servers.filter(server => server.server_id !== serverId)
      });

      if (selectedServerId === serverId) {
        const remainingServers = user.servers.filter(s => s.server_id !== serverId);
        setSelectedServerId(remainingServers.length > 0 ? remainingServers[0].server_id : null);
      }
    } catch (err) {
      console.error('서버 삭제 실패:', err);
      alert('서버 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="h-screen w-16 flex flex-col bg-discord900 shadow-lg">
      <SidebarIcon
        icon={<HomeIcon />}
        text="홈"
        isSelected={selectedServerId === null}
        onClick={() => setSelectedServerId(null)}
      />
      {user?.servers?.map((server) => (
        <SidebarIcon
          key={server.server_id}
          icon={
            server.server_image ? (
              <img
                src={server.server_image}
                alt={server.server_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-discord700 flex items-center justify-center">
                {server.server_name.charAt(0).toUpperCase()}
              </div>
            )
          }
          text={server.server_name}
          isSelected={selectedServerId === server.server_id}
          onClick={() => setSelectedServerId(server.server_id)}
          onRemove={() => handleRemoveServer(server.server_id)}
        />
      ))}
      <SidebarIcon
        icon={<span className="text-2xl">+</span>}
        text="서버 추가"
        noLeftBar={true}
        onClick={handleAddServer}
      />
    </div>
  );
};

export default Sidebar;