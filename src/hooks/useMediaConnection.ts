import { useCallback, useEffect } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { useUserStore } from '@/stores/userStore';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { MediaChannelType, VoiceStateUpdate } from '@/services/call/socket/types';
import { useCall } from '@/services/call/CallProvider';

export function useMediaConnection() {
  const { connection } = useCall();
  const mediaStore = useMediaStore();
  const userStore = useUserStore();
  const webrtc = WebRTCConnection.getInstance();

  const joinChannel = useCallback(
    async (channelId: string, type: MediaChannelType) => {
      if (!connection) return false;

      const success = await connection.joinChannel(channelId, type);
      if (success) {
        // Initialize local stream based on channel type
        const localStream = await webrtc.initializeLocalStream(type === 'VIDEO');
        if (localStream) {
          // Create peer connections with existing users
          userStore.users.forEach(user => {
            if (user.user_id !== userStore.currentUser?.user_id) {
              webrtc.createPeerConnection(user.user_id);
            }
          });
        }
      }
      return success;
    },
    [connection]
  );

  const leaveChannel = useCallback(() => {
    if (!connection) return;
    connection.leaveChannel();
  }, [connection]);

  const updateState = useCallback(
    (update: VoiceStateUpdate) => {
      if (!connection) return;

      // Update local state
      const {
        muted = mediaStore.isMuted,
        deafened = mediaStore.isDeafened,
        camera_on = !mediaStore.isCameraOff,
        screen_sharing = mediaStore.isScreenSharing,
      } = update;

      // Update media state
      if ('muted' in update) mediaStore.setMuted(muted);
      if ('deafened' in update) mediaStore.setDeafened(deafened);
      if ('camera_on' in update) mediaStore.setCameraOff(!camera_on);
      if ('screen_sharing' in update) mediaStore.setScreenSharing(screen_sharing);

      // Send update to server
      connection.updateState(update);
    },
    [connection, mediaStore]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, [leaveChannel]);

  return {
    joinChannel,
    leaveChannel,
    updateState,
  };
}