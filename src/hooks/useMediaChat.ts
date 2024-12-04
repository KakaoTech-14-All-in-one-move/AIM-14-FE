import { useCallback } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { useMediaConnection } from './useMediaConnection';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { MediaDevicesManager } from '@/services/call/webrtc/MediaDevicesManager';
import { useMediaChatStore } from '@/stores/useMediaChatStore';

export function useMediaChat() {
  const mediaStore = useMediaStore();
  const mediaChatStore = useMediaChatStore();
  const { updateState } = useMediaConnection(); // TODO : 뭐지?
  const webrtc = WebRTCConnection.getInstance();

  const toggleMute = useCallback(async () => {
    const newMuted = !mediaStore.isMuted;
    await webrtc.toggleAudio(!newMuted);
    updateState({ muted: newMuted });
  }, [mediaStore.isMuted, updateState]);

  const toggleDeafen = useCallback(async () => {
    const newDeafened = !mediaStore.isDeafened;
    webrtc.toggleDeafen(newDeafened);
    updateState({ deafened: newDeafened });
  }, [mediaStore.isDeafened, updateState]);

  const toggleCamera = useCallback(async () => {
    if (!mediaChatStore.currentUserId) return;

    try {
      const currentState = mediaChatStore.userStates.get(mediaChatStore.currentUserId);
      const newCameraState = !(currentState?.cameraOn);

      if (newCameraState) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        await webrtc.toggleVideo(true);
        mediaChatStore.setStream(mediaChatStore.currentUserId, stream);
        mediaChatStore.updateUserState(mediaChatStore.currentUserId, { cameraOn: true });
        updateState({ camera_on: true });
      } else {
        await webrtc.toggleVideo(false);
        mediaChatStore.setStream(mediaChatStore.currentUserId, null);
        mediaChatStore.updateUserState(mediaChatStore.currentUserId, { cameraOn: false });
        updateState({ camera_on: false });
      }
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  }, [mediaChatStore.currentUserId, webrtc, updateState]);

  const toggleScreenShare = useCallback(async () => {
    if (!mediaChatStore.currentUserId) return;

    try {
      const currentState = mediaChatStore.userStates.get(mediaChatStore.currentUserId);
      const newScreenShareState = !(currentState?.screenSharing);

      if (newScreenShareState) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        await webrtc.startScreenShare();
        mediaChatStore.setStream(mediaChatStore.currentUserId, stream, true);
        mediaChatStore.updateUserState(mediaChatStore.currentUserId, { screenSharing: true });
        updateState({ screen_sharing: true });
      } else {
        await webrtc.stopScreenShare();
        mediaChatStore.setStream(mediaChatStore.currentUserId, null, true);
        mediaChatStore.updateUserState(mediaChatStore.currentUserId, { screenSharing: false });
        updateState({ screen_sharing: false });
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [mediaChatStore.currentUserId, webrtc, updateState]);

  const changeAudioInput = useCallback(async (deviceId: string) => {
    try {
      await webrtc.changeAudioDevice(deviceId);
      mediaStore.setAudioInput(deviceId);
    } catch (error) {
      console.error('Failed to change audio input:', error);
    }
  }, []);

  const changeAudioOutput = useCallback(async (deviceId: string) => {
    try {
      const mediaDevices = MediaDevicesManager.getInstance();
      const remoteVideos = document.querySelectorAll<HTMLVideoElement>('.remote-video');
      await Promise.all(
        Array.from(remoteVideos).map(element =>
          mediaDevices.setSinkId(element, deviceId),
        ),
      );
      mediaStore.setAudioOutput(deviceId);
    } catch (error) {
      console.error('Failed to change audio output:', error);
    }
  }, []);

  return {
    isMuted: mediaStore.isMuted,
    isDeafened: mediaStore.isDeafened,
    isCameraOff: mediaStore.isCameraOff,
    isScreenSharing: mediaStore.isScreenSharing,
    speaking: mediaStore.speaking,
    userStates: mediaChatStore.userStates,
    speakingUsers: mediaChatStore.speakingUsers,
    currentUserId: mediaChatStore.currentUserId,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    changeAudioInput,
    changeAudioOutput,
    updateUserState: mediaChatStore.updateUserState,
    setCurrentUserId: mediaChatStore.setCurrentUserId,
    resetState: mediaChatStore.resetState,
  };
}