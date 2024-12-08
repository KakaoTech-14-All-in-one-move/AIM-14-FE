import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { MediaState, MediaType } from '@/services/call/types.ts';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager.ts';

export function useMediaConnection() {
  const navigate = useNavigate();
  const mediaManager = MediaConnectionManager.getInstance();
  const { currentUserChannel } = useUserChannelStore();

  const joinChannel = useCallback(async (channelId: string, type: MediaType) => {
    const success = await mediaManager.joinChannel(channelId, type);
    if (success) {
      navigate(`/${type.toLowerCase()}/${channelId}`);
    }
    return success;
  }, [navigate]);

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