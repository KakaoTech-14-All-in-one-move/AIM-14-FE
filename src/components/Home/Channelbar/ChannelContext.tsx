// ChannelContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { ChannelContextType, Channels, ChannelStateType, ChannelType } from '@/components/Home/Channelbar/types';
import { useAuthStore } from '@/stores/authStore';

export const ChannelContext = createContext<ChannelContextType | null>(null);

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);

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

  const [channelStates, setChannelStates] = useState<ChannelStateType>({
    voice: {
      active: { '일반': false },
      joined: { '일반': false }
    },
    video: {
      active: { '일반': false },
      joined: { '일반': false }
    }
  });

  // 기본 채널 관리 함수들 메모이제이션
  const addChannel = useCallback((type: ChannelType, name: string) => {
    setChannels(prev => ({
      ...prev,
      [type]: [...prev[type], name],
    }));
  }, []);

  const renameChannel = useCallback((type: ChannelType, oldName: string, newName: string) => {
    setChannels(prev => ({
      ...prev,
      [type]: prev[type].map(channelName =>
        channelName === oldName ? newName : channelName,
      ),
    }));
  }, []);

  const deleteChannel = useCallback((type: ChannelType, channelName: string) => {
    setChannels(prev => ({
      ...prev,
      [type]: prev[type].filter(name => name !== channelName),
    }));

    if (type !== 'text') {
      setChannelStates(prev => ({
        ...prev,
        [type]: {
          active: Object.fromEntries(
            Object.entries(prev[type].active).filter(([key]) => key !== channelName),
          ),
          joined: Object.fromEntries(
            Object.entries(prev[type].joined).filter(([key]) => key !== channelName),
          ),
        },
      }));
    }
  }, []);

  const toggleSection = useCallback((type: ChannelType) => {
    setOpenSections(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, []);

  // 채널 상태 관리 함수들 메모이제이션
  const activateChannel = useCallback((type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        active: { ...prev[type].active, [channelName]: true },
      },
    }));
  }, []);

  const deactivateChannel = useCallback((type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        active: { ...prev[type].active, [channelName]: false },
      },
    }));
  }, []);

  const joinChannel = useCallback((type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        joined: { ...prev[type].joined, [channelName]: true },
      },
    }));
  }, []);

  const leaveChannel = useCallback((type: Exclude<ChannelType, 'text'>, channelName: string) => {
    setChannelStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        joined: { ...prev[type].joined, [channelName]: false },
      },
    }));
  }, []);

  // context value도 메모이제이션
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
  if (context === null) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
};