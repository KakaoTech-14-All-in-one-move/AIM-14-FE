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

    try {
      const newCameraState = !currentState.mediaState.isCameraOn;
      const currentStream = currentState.mediaState.stream;

      if (newCameraState) {
        // 카메라 켤 때
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (currentStream) {
          // 기존 스트림이 있다면 비디오 트랙만 추가
          const videoTrack = videoStream.getVideoTracks()[0];
          currentStream.addTrack(videoTrack);
          updateMediaState({ isCameraOn: true });
        } else {
          // 기존 스트림이 없다면 새로운 스트림 생성
          updateMediaState({
            isCameraOn: true,
            stream: videoStream
          });
        }
      } else {
        // 카메라 끌 때
        if (currentStream) {
          // 비디오 트랙만 제거
          currentStream.getVideoTracks().forEach(track => {
            track.stop();
            currentStream.removeTrack(track);
          });
        }
        updateMediaState({ isCameraOn: false });
      }
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  }, [getCurrentUserState, updateMediaState]);

  const toggleScreenShare = useCallback(async () => {
    const currentState = getCurrentUserState();
    if (!currentState) return;

    try {
      const newScreenShareState = !currentState.mediaState.isScreenSharing;

      if (newScreenShareState) {
        const stream = await mediaServer.startScreenShare();
        if (stream) {
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