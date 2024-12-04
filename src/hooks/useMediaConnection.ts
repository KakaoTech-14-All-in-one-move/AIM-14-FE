import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MediaType } from '@/services/call/types';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager';
import { useCall } from '@/services/call/CallProvider.tsx';

interface MediaConnectionState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  currentChannelId: string | null;
  currentChannelType: MediaType | null;
  lastError: Error | null;
}

export function useMediaConnection() {
  const navigate = useNavigate();
  const { connection } = useCall();
  const mediaManager = MediaConnectionManager.getInstance();
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (connection) {
      mediaManager.setCallConnection(connection);
    }
  }, [connection]);

  // 상태 업데이트 구독
  useEffect(() => {
    const unsubscribe = mediaManager.onStateUpdate((state) => {
      setCurrentChannelId(state.currentChannelId);
    });

    // 초기 상태 설정
    const initialState = mediaManager.getState();
    setCurrentChannelId(initialState.currentChannelId);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

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

  const onStateUpdate = useCallback((callback: (state: MediaConnectionState) => void) => {
    return mediaManager.onStateUpdate(callback);
  }, []);

  return {
    joinChannel,
    leaveChannel,
    currentChannelId, // 이제 명시적으로 currentChannelId를 반환
    connectionState: mediaManager.getState(),
    onStateUpdate
  };
}