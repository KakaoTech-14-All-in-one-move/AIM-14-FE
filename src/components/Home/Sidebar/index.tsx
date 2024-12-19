import React, { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarIcon } from '@/components/Home/Sidebar/SidebarIcon';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useChannelStore } from '@/stores/channelStore';
import { apiClient } from '@/api/apiClient';
import { Channel, Server } from '@/types/server';

const Sidebar: FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { selectedServerId, setSelectedServerId } = useServerStore();
  const { setCurrentChannel, setChannels } = useChannelStore();

  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL;

  const getFullImageUrl = (imageUrl: string | undefined) => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BASE_URL}${imageUrl}`;
  };

  const selectOldestChatChannel = async (serverId: number) => {
    try {
      const response = await apiClient.client.get(`/api/v1/servers/${serverId}/channels`);
      const channels: Channel[] = response.data;

      setChannels(channels);

      const chatChannels = channels
        .filter(channel => channel.channelCategory === 'CHAT')
        .sort((a, b) => a.channelPosition - b.channelPosition);

      if (chatChannels.length > 0) {
        const oldestChannel = chatChannels[0];
        setCurrentChannel(oldestChannel);
        navigate(`/channels/${serverId}/${oldestChannel.channelId}`);
      }
    } catch (error) {
      console.error('채널 목록을 불러오는데 실패했습니다:', error);
    }
  };

  const handleServerSelect = (serverId: number) => {
    setSelectedServerId(serverId);
    selectOldestChatChannel(serverId);
  };

  const handleAddServer = async () => {
    try {
      const name = prompt('서버 이름을 입력하세요:');
      if (!name || !user) return;

      const response = await apiClient.client.post('/api/v1/servers', {
        server_name: name
      });
      const newServer: Server = response.data;

      setUser({
        ...user,
        servers: [...(user.servers || []), newServer]
      });

      const serverStore = useServerStore.getState();
      serverStore.addServer(newServer);
      serverStore.setSelectedServerId(newServer.server_id);
      selectOldestChatChannel(newServer.server_id);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '서버 생성에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const handleRemoveServer = async (serverId: number) => {
    try {
      if (!user) return;

      const serverToDelete = user.servers.find(server => server.server_id === serverId);
      if (!serverToDelete) return;

      const isConfirmed = window.confirm(
        `'${serverToDelete.server_name}' 서버를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      );

      if (!isConfirmed) return;

      await apiClient.client.delete(`/api/v1/servers/${serverId}`);

      setUser({
        ...user,
        servers: user.servers.filter(server => server.server_id !== serverId)
      });

      if (selectedServerId === serverId) {
        const remainingServers = user.servers.filter(s => s.server_id !== serverId);
        if (remainingServers.length > 0) {
          setSelectedServerId(remainingServers[0].server_id);
          selectOldestChatChannel(remainingServers[0].server_id);
        } else {
          setSelectedServerId(null);
          setCurrentChannel(null);
          setChannels([]);
          navigate('/home');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '서버 삭제에 실패했습니다.';
      alert(errorMessage);
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

      const serverStore = useServerStore.getState();
      serverStore.setServers(
        serverStore.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_name: newName }
            : server
        )
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '서버 이름 변경에 실패했습니다.';
      alert(errorMessage);
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

      setUser({
        ...user,
        servers: user.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_image: BASE_URL + serverImageUrl }
            : server
        )
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '서버 이미지 업로드에 실패했습니다.';
      alert(errorMessage);
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
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '멤버 초대에 실패했습니다.';
      alert(errorMessage);
    }
  };

  return (
    <div className="h-screen w-16 flex flex-col bg-discord900 shadow-lg">
      <SidebarIcon
        icon={<HomeIcon />}
        text="홈"
        isSelected={selectedServerId === null}
        onClick={() => {
          setSelectedServerId(null);
          setCurrentChannel(null);
          setChannels([]);
          navigate('/home');
        }}
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
          onClick={() => handleServerSelect(server.server_id)}
          onRename={(newName) => handleRenameServer(server.server_id, newName)}
          onRemove={() => handleRemoveServer(server.server_id)}
          onImageUpload={(file) => handleImageUpload(server.server_id, file)}
          onInvite={() => handleInvite(server.server_id)}
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