// src/components/Home/index.tsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';
import ChatArea from '@/components/Home/ChatArea';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';

const Home: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const user = useAuthStore((state) => state.user);
  const setChannels = useChannelStore((state) => state.setChannels);
  const setSelectedServerId = useServerStore((state) => state.setSelectedServerId);

  // 서버 ID가 변경될 때 selectedServerId 업데이트
  useEffect(() => {
    if (serverId) {
      setSelectedServerId(Number(serverId));
    }
  }, [serverId, setSelectedServerId]);

  // 유저 정보가 있을 때 채널 정보 초기화
  useEffect(() => {
    if (user?.servers) {
      // 현재 선택된 서버의 채널들만 필터링
      const selectedServer = user.servers.find(server =>
        server.server_id === Number(serverId)
      );

      if (selectedServer?.channels) {
        setChannels(selectedServer.channels);
      } else {
        setChannels([]); // 선택된 서버가 없거나 채널이 없는 경우 빈 배열로 초기화
      }
    }
  }, [user, serverId, setChannels]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <Channelbar />
      <ChatArea />
    </div>
  );
};

export default Home;