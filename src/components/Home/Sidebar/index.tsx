import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SidebarIcon } from './SidebarIcon';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { apiClient } from '@/api/apiClient';
import { useCall } from '@/services/call/CallProvider';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';
import { useUserChannelStore } from '@/stores/userChannelStore';

const Sidebar: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const { selectedServerId, setSelectedServerId } = useServerStore();
  const { connection } = useCall();
  const { currentUserChannel } = useUserChannelStore();
  const mediaManager = MediaConnectionManager.getInstance();
  const navigate = useNavigate();
  const location = useLocation();

  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL;

  const handleServerChange = useCallback(async (serverId: number) => {
    if (!connection) {
      console.error('No connection available');
      return;
    }

    try {
      // 현재 채널이 있다면 먼저 나가기
      if (currentUserChannel.channelId) {
        await mediaManager.leaveChannel();
      }

      // 새 서버 입장 요청 및 연결 업데이트
      const success = await connection.setCurrentServerId(serverId.toString());
      if (!success) {
        throw new Error('Failed to connect to server');
      }

      setSelectedServerId(serverId);
      navigate(`/channels/${serverId}`);

    } catch (error) {
      console.error('Server change failed:', error);
      alert('서버 변경에 실패했습니다.');
    }
  }, [connection, currentUserChannel.channelId, mediaManager, setSelectedServerId, navigate]);

  useEffect(() => {
    const isRootPath = location.pathname === '/';
    if (isRootPath && user?.servers?.length! > 0) {
      const firstServer = user!.servers[0];
      handleServerChange(firstServer.server_id);
    }
  }, [user?.servers, location.pathname, handleServerChange]);

  const getFullImageUrl = (imageUrl: string | undefined) => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BASE_URL}${imageUrl}`;
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
        },
      );

      const { serverImageUrl } = response.data;

      setUser({
        ...user,
        servers: user.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_image: BASE_URL + serverImageUrl }
            : server,
        ),
      });

      const serverStore = useServerStore.getState();
      serverStore.setServers(
        serverStore.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_image: BASE_URL + serverImageUrl }
            : server,
        ),
      );

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
        email: email.trim(),
      });

      alert('멤버를 성공적으로 초대했습니다.');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '멤버 초대에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const handleAddServer = async () => {
    try {
      const name = prompt('서버 이름을 입력하세요:');
      if (!name || !user) return;

      const response = await apiClient.client.post('/api/v1/servers', {
        server_name: name,
      });
      const newServer = response.data;

      setUser({
        ...user,
        servers: [...(user.servers || []), newServer],
      });

      const serverStore = useServerStore.getState();
      serverStore.addServer(newServer);
      await handleServerChange(newServer.server_id);

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
        servers: user.servers.filter(server => server.server_id !== serverId),
      });

      // 현재 서버가 삭제된 경우 다른 서버로 이동
      if (selectedServerId === serverId) {
        const remainingServers = user.servers.filter(s => s.server_id !== serverId);
        if (remainingServers.length > 0) {
          await handleServerChange(remainingServers[0].server_id);
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
        server_name: newName,
      });

      setUser({
        ...user,
        servers: user.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_name: newName }
            : server
        ),
      });

      const serverStore = useServerStore.getState();
      serverStore.setServers(
        serverStore.servers.map(server =>
          server.server_id === serverId
            ? { ...server, server_name: newName }
            : server
        ),
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '서버 이름 변경에 실패했습니다.';
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
          if (user?.servers?.length! > 0) {
            const firstServer = user!.servers[0];
            handleServerChange(firstServer.server_id);
          }
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
          onClick={() => handleServerChange(server.server_id)}
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

export default Sidebar