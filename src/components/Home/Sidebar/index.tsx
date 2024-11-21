import React, { useState } from 'react';
import { SidebarIcon } from '@/components/Home/Sidebar/SidebarIcon';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/apiClient';

const Sidebar: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL

  const getFullImageUrl = (imageUrl: string | undefined) => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith('http')) return imageUrl;  // 이미 전체 URL인 경우
    return `${BASE_URL}${imageUrl}`;
  };

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

  const handleRenameServer = async (serverId: number, newName: string) => {
    try {
      if (!user) return;

      await apiClient.client.put(`/api/v1/servers/${serverId}/name`, {
        server_name: newName
      });

      setUser({
        ...user,
        servers: user.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_name: newName }
            : server
        )
      });
    } catch (err) {
      console.error('서버 이름 변경 실패:', err);
      alert('서버 이름 변경에 실패했습니다.');
    }
  };

  const handleImageUpload = async (serverId: number, file: File) => {
    try {
      if (!user) return;

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.client.post(
        `/api/v1/servers/${serverId}/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const { serverImageUrl } = response.data;
      const BASE_URL = import.meta.env.VITE_BE_SERVER_URL

      setUser({
        ...user,
        servers: user.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_image: BASE_URL + serverImageUrl }
            : server
        )
      });
    } catch (err) {
      console.error('서버 이미지 업로드 실패:', err);
      alert('서버 이미지 업로드에 실패했습니다.');
    }
  };

  const handleInvite = async (serverId: number) => {
    try {
      const email = prompt('초대할 멤버의 이메일을 입력하세요:');
      if (!email || !email.trim()) return;

      await apiClient.client.post(`/api/v1/servers/${serverId}/invite`, {
        email: email.trim()
      });

      alert('멤버를 성공적으로 초대했습니다.');
    } catch (err: any) {
      console.error('멤버 초대 실패:', err);
      alert(err.response?.data?.error || '멤버 초대에 실패했습니다.');
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
                src={getFullImageUrl(server.server_image)}
                alt={server.server_name}
                className="w-full h-full object-cover"
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
          onRename={(newName) => handleRenameServer(server.server_id, newName)}
          onRemove={() => handleRemoveServer(server.server_id)}
          onImageUpload={(file) => handleImageUpload(server.server_id, file)}
          onInvite={() => handleInvite(server.server_id)}  // 여기에 onInvite prop 추가
          hasServerImage={!!server.server_image}
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