import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChannelContextType, Channels, ChannelStateType, ChannelType } from './types';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { Channel } from '@/types/server';

export const ChannelContext = createContext<ChannelContextType | null>(null);

interface ChannelProviderProps {
  children: React.ReactNode;
}

export const ChannelProvider: React.FC<ChannelProviderProps> = ({ children }) => {
  const { user } = useAuthStore();
  const { selectedServerId } = useServerStore();

  // 선택된 서버 찾기
  const selectedServer = user?.servers?.find(server => server.server_id === selectedServerId);

  const [channels, setChannels] = useState<Record<ChannelType, Channel[]>>({
    text: [],
    voice: [],
    video: []
  });

  const [openSections, setOpenSections] = useState<Record<ChannelType, boolean>>({
    text: true,
    voice: true,
    video: true,
  });

  const [channelStates, setChannelStates] = useState<ChannelStateType>({
    voice: {
      active: {},
      joined: {}
    },
    video: {
      active: {},
      joined: {}
    }
  });

  // 서버나 채널이 변경될 때마다 채널 목록 업데이트
  useEffect(() => {
    if (!selectedServer?.channels) {
      setChannels({
        text: [],
        voice: [],
        video: []
      });
      return;
    }

    const newChannels: Record<ChannelType, Channel[]> = {
      text: [],
      voice: [],
      video: []
    };

    // 채널들을 카테고리별로 분류
    selectedServer.channels.forEach(channel => {
      switch (channel.channelCategory) {
        case 'CHAT':
          newChannels.text.push(channel);
          break;
        case 'VOICE':
          newChannels.voice.push(channel);
          break;
        case 'VIDEO':
          newChannels.video.push(channel);
          break;
      }
    });

    // 각 카테고리 내에서 position 순으로 정렬
    Object.keys(newChannels).forEach(key => {
      newChannels[key as ChannelType].sort((a, b) => a.channelPosition - b.channelPosition);
    });

    setChannels(newChannels);

    // 채널 상태 초기화
    const newChannelStates: ChannelStateType = {
      voice: {
        active: Object.fromEntries(newChannels.voice.map(channel => [channel.channelName, false])),
        joined: Object.fromEntries(newChannels.voice.map(channel => [channel.channelName, false]))
      },
      video: {
        active: Object.fromEntries(newChannels.video.map(channel => [channel.channelName, false])),
        joined: Object.fromEntries(newChannels.video.map(channel => [channel.channelName, false]))
      }
    };

    setChannelStates(prev => ({
      voice: {
        active: { ...prev.voice.active, ...newChannelStates.voice.active },
        joined: { ...prev.voice.joined, ...newChannelStates.voice.joined }
      },
      video: {
        active: { ...prev.video.active, ...newChannelStates.video.active },
        joined: { ...prev.video.joined, ...newChannelStates.video.joined }
      }
    }));
  }, [selectedServer?.channels]);

  // 나머지 함수들은 그대로 유지...
  const addChannel = useCallback((type: ChannelType, channel: Channel) => {
    setChannels(prev => ({
      ...prev,
      [type]: [...prev[type], channel]
    }));
  }, []);

  const renameChannel = useCallback((type: ChannelType, channelId: number, newName: string) => {
    setChannels(prev => ({
      ...prev,
      [type]: prev[type].map(channel =>
        channel.channelId === channelId
          ? { ...channel, channelName: newName }
          : channel
      )
    }));
  }, []);

  const deleteChannel = useCallback((type: ChannelType, channelId: number) => {
    setChannels(prev => ({
      ...prev,
      [type]: prev[type].filter(channel => channel.channelId !== channelId)
    }));

    if (type !== 'text') {
      setChannelStates(prev => ({
        ...prev,
        [type]: {
          active: {},
          joined: {}
        }
      }));
    }
  }, []);

  const renameChannel = useCallback((channelId: string, newName: string) => {
    setChannels(prev =>
      prev.map(channel =>
        channel.id === channelId
          ? { ...channel, name: newName }
          : channel
      )
    );
  }, []);

  const deleteChannel = useCallback((channelId: string) => {
    setChannels(prev => prev.filter(channel => channel.id !== channelId));

    const channel = channels.find(ch => ch.id === channelId);
    if (channel && channel.type !== 'text') {
      setChannelStates(prev => {
        const newStates = { ...prev };
        delete newStates[channelId];
        return newStates;
      });
    }
  }, [channels]);

  const toggleSection = useCallback((type: ChannelType) => {
    setOpenSections(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  }, []);

  const activateChannel = useCallback((type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        active: { ...prev[type].active, [channelName]: true }
      }
    }));
  }, []);

  const deactivateChannel = useCallback((channelId: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        active: { ...prev[type].active, [channelName]: false }
      }
    }));
  }, []);

  const joinChannel = useCallback((channelId: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        joined: { ...prev[type].joined, [channelName]: true }
      }
    }));
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        joined: { ...prev[type].joined, [channelName]: false }
      }
    }));
  }, []);

  const contextValue = React.useMemo(() => ({
    channels,
    addChannel,
    renameChannel,
    deleteChannel,
    openSections,
    toggleSection,
    channelStates,
    activateChannel,
    deactivateChannel,
    joinChannel,
    leaveChannel,
    currentUser: user
  }), [
    channels,
    addChannel,
    renameChannel,
    deleteChannel,
    openSections,
    toggleSection,
    channelStates,
    activateChannel,
    deactivateChannel,
    joinChannel,
    leaveChannel,
    user
  ]);

  return (
    <ChannelContext.Provider value={contextValue}>
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannels = () => {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
};