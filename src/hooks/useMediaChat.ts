import { useCallback } from 'react';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { useMediaConnection } from './useMediaConnection';
import { useMediaDeviceStore } from '@/stores/mediaDeviceStore';
import { useAuthStore } from '@/stores/authStore';
import { MediaServerConnection } from '@/services/call/webrtc/MediaServerConnection';

export function useMediaChat() {
  const userChannelStore = useUserChannelStore();
  const mediaDeviceStore = useMediaDeviceStore();
  const { updateMediaState, leaveChannel } = useMediaConnection();
  const mediaServer = MediaServerConnection.getInstance();
  const currentUser = useAuthStore(state => state.user);

  const getCurrentUserState = useCallback(() => {
    if (!currentUser?.email || !userChannelStore.currentUserChannel.channelId) return null;
    const channelUsers = userChannelStore.channelUsers.get(userChannelStore.currentUserChannel.channelId) || [];
    return channelUsers.find(user => user.userId === currentUser.email);
  }, [currentUser, userChannelStore.currentUserChannel.channelId, userChannelStore.channelUsers]);

  const toggleMute = useCallback(async () => {
    const currentState = getCurrentUserState();
    if (!currentState) return;

    const newMuted = !currentState.mediaState.isMuted;
    updateMediaState({ isMuted: newMuted });
  }, [getCurrentUserState, updateMediaState]);

  const toggleDeafen = useCallback(async () => {
    const currentState = getCurrentUserState();
    if (!currentState) return;

    const newDeafened = !currentState.mediaState.isDeafened;
    updateMediaState({ isDeafened: newDeafened });
  }, [getCurrentUserState, updateMediaState]);

  const toggleCamera = useCallback(async () => {
    const currentState = getCurrentUserState();
    if (!currentState) return;

    // 단순히 상태 업데이트만 요청
    updateMediaState({ isCameraOn: !currentState.mediaState.isCameraOn });
  }, [getCurrentUserState, updateMediaState]);

  const toggleScreenShare = useCallback(async () => {
    const currentState = getCurrentUserState();
    if (!currentState) return;

    try {
      const newScreenShareState = !currentState.mediaState.isScreenSharing;

      // 이미 상태 변경 중인지 확인하는 ref 추가
      if ((toggleScreenShare as any).isProcessing) {
        return;
      }
      (toggleScreenShare as any).isProcessing = true;

      if (newScreenShareState) {
        const stream = await mediaServer.startScreenShare().catch(error => {
          // 사용자가 공유를 취소한 경우
          if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
            return null;
          }
          throw error;
        });

        if (stream) {
          // 화면 공유가 실제로 시작될 때만 상태 업데이트
          stream.getVideoTracks()[0].onended = () => {
            toggleScreenShare();
          };

          updateMediaState({
            isScreenSharing: true,
            screenStream: stream,
          });
        }
      } else {
        await mediaServer.stopScreenShare();
        updateMediaState({
          isScreenSharing: false,
          screenStream: null,
        });
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    } finally {
      (toggleScreenShare as any).isProcessing = false;
    }
  }, [getCurrentUserState, mediaServer, updateMediaState]);

  const changeAudioInput = useCallback(async (deviceId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      mediaDeviceStore.setSelectedDevice('audioInput', deviceId);

      const currentState = getCurrentUserState();
      if (currentState) {
        updateMediaState({ stream });
      }
    } catch (error) {
      console.error('Failed to change audio input:', error);
    }
  }, [getCurrentUserState, updateMediaState]);

  const changeAudioOutput = useCallback(async (deviceId: string) => {
    try {
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('.remote-audio, .remote-video');
      await Promise.all(
        Array.from(mediaElements).map(element =>
          // @ts-ignore: setSinkId exists but TypeScript doesn't know about it
          element.setSinkId(deviceId)
        )
      );
      mediaDeviceStore.setSelectedDevice('audioOutput', deviceId);
    } catch (error) {
      console.error('Failed to change audio output:', error);
    }
  }, []);

  const currentState = getCurrentUserState();

  return {
    // 상태
    isMuted: currentState?.mediaState.isMuted ?? false,
    isDeafened: currentState?.mediaState.isDeafened ?? false,
    isCameraOn: currentState?.mediaState.isCameraOn ?? false,
    isScreenSharing: currentState?.mediaState.isScreenSharing ?? false,
    speaking: currentState?.mediaState.isSpeaking ?? false,

    // 현재 채널 사용자들
    channelUsers: userChannelStore.channelUsers.get(userChannelStore.currentUserChannel.channelId ?? '') ?? [],
    currentChannelId: userChannelStore.currentUserChannel.channelId,

    // 액션
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    changeAudioInput,
    changeAudioOutput,
    leaveChannel,  // 추가
  };
}