import React, { createContext, useContext, useState } from 'react';
import {
  ChannelContextType,
  Channels,
  ChannelType,
  User,
} from '@/components/Home/Channelbar/types';
import { getUserData } from '@/components/Home/Channelbar/types';

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
