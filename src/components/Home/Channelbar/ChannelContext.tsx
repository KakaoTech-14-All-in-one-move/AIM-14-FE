import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ChannelContextType,
  Channels,
  ChannelType,
  User,
} from '@/components/Home/Channelbar/types';
import { getUserData } from '@/components/Home/Channelbar/types';
import { ServerData } from '../../../services/call/types.ts';

export const ChannelContext = createContext<ChannelContextType | null>(null);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [channels, setChannels] = useState<Channels>({
    text: ['일반', '풀스택', '인공지능', '클라우드'],
    voice: ['일반'],
    video: ['일반'],
  });
  const [openSections, setOpenSections] = useState<Record<ChannelType, boolean>>({
    text: true,
    voice: true,
    video: true,
  });
  const [activeChannels, setActiveChannels] = useState<
    Record<Exclude<ChannelType, 'text'>, Record<string, boolean>>
  >({
    voice: {},
    video: {},
  });
  const [currentUser] = useState<User>(getUserData());
  const [serverData, setServerData] = useState<ServerData | null>(null);

  useEffect(() => {
    // 로그인 성공 후 서버 데이터 fetch 예시
    // const fetchServerData = async () => {
    //   try {
    //     const response = await apiClient.get('/api/v1/servers/me');
    //     setServerData(response.data);
    //
    //     // 받아온 채널 데이터로 channels 상태 업데이트
    //     const channelsByType = response.data.channels.reduce((acc, channel) => ({
    //       ...acc,
    //       [channel.type]: [...(acc[channel.type] || []), channel.name]
    //     }), {
    //       text: [],
    //       voice: [],
    //       video: []
    //     });
    //     setChannels(channelsByType);
    //   } catch (error) {
    //     console.error('Failed to fetch server data:', error);
    //   }
    // };
    //
    // fetchServerData();
  }, []);

  // 채널 ID를 얻기 위한 유틸리티 함수 추가
  const getChannelId = (channelName: string, type: ChannelType): string | undefined => {
    return serverData?.channels.find(
        (channel: { name: string; type: any; }) => channel.name === channelName && channel.type === type
    )?.id;
  };

  const addChannel = (type: ChannelType, name: string) => {
    setChannels((prevChannels: Channels) => ({
      ...prevChannels,
      [type]: [...prevChannels[type], name],
    }));
  };

  const renameChannel = (type: ChannelType, oldName: string, newName: string) => {
    setChannels((prevChannels: Channels) => ({
      ...prevChannels,
      [type]: prevChannels[type].map((channelName: string) =>
        channelName === oldName ? newName : channelName,
      ),
    }));
  };

  const deleteChannel = (type: ChannelType, channelName: string) => {
    setChannels((prevChannels: Channels) => ({
      ...prevChannels,
      [type]: prevChannels[type].filter((name: string) => name !== channelName),
    }));
    if (type !== 'text') {
      setActiveChannels((prev) => ({
        ...prev,
        [type]: Object.fromEntries(
          Object.entries(prev[type]).filter(([key]) => key !== channelName),
        ),
      }));
    }
  };

  const toggleSection = (type: ChannelType) => {
    setOpenSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const joinChannel = (type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setActiveChannels((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channelName]: true,
      },
    }));
  };

  const leaveChannel = (type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setActiveChannels((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channelName]: false,
      },
    }));
  };

  return (
    <ChannelContext.Provider
      value={{
        channels,
        addChannel,
        renameChannel,
        deleteChannel,
        openSections,
        toggleSection,
        activeChannels,
        joinChannel,
        leaveChannel,
        currentUser,
        getChannelId,
        serverData
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannels = () => {
  const context = useContext(ChannelContext);
  if (context === null) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
};
