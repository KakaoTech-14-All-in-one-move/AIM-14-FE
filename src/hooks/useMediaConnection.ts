import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { MediaState, MediaType } from '@/services/call/types.ts';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager.ts';
import { ChannelNavigator } from '@/components/Provider/ChannelNavigator.ts';

export function useMediaConnection() {
  const navigate = useNavigate();
  const mediaManager = MediaConnectionManager.getInstance();
  const { currentUserChannel } = useUserChannelStore();
  const channelNavigator = ChannelNavigator.getInstance();

  useEffect(() => {
    channelNavigator.setNavigate(navigate);
  }, [navigate]);

  const joinChannel = useCallback(async (channelId: string, type: MediaType) => {
    return channelNavigator.handleChannelEnter(channelId, type);
  }, []);

  const leaveChannel = useCallback(async () => {
    await mediaManager.leaveChannel();
    navigate('/channels');
  }, [navigate]);

  const updateMediaState = useCallback((updates: Partial<MediaState>) => {
    mediaManager.updateMediaState(updates);
  }, []);

  return {
    joinChannel,
    leaveChannel,
    updateMediaState,
    currentChannelId: currentUserChannel.channelId,
    channelType: currentUserChannel.channelType,
  };
}