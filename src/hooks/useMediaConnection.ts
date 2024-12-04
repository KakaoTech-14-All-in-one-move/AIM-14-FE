import { useCallback, useEffect } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { useUserStore } from '@/stores/userStore';
import { useMediaChatStore } from '@/stores/useMediaChatStore';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { MediaChannelType, VoiceStateUpdate } from '@/services/call/socket/types';
import { useCall } from '@/services/call/CallProvider';

export function useMediaConnection() {
  const { connection } = useCall();
  const mediaStore = useMediaStore();
  const userStore = useUserStore();
  const mediaChatStore = useMediaChatStore();
  const webrtc = WebRTCConnection.getInstance();

  const joinChannel = useCallback(
    async (channelId: string, type: MediaChannelType) => {
      if (!connection || !mediaChatStore.currentUserId) return false;

      // 다른 채널에 이미 접속해 있는 경우 처리
      if (mediaStore.channelId) {
        await leaveCurrentChannel();
      }

      const success = await connection.joinChannel(channelId, type);
      if (success) {
        // 로컬 스트림 초기화
        const localStream = await webrtc.initializeLocalStream(type === 'VIDEO');
        if (localStream) {
          mediaChatStore.setStream(mediaChatStore.currentUserId, localStream);

          // 기존 사용자들과 연결 설정
          userStore.users.forEach(user => {
            if (user.user_id !== mediaChatStore.currentUserId) {
              webrtc.createPeerConnection(user.user_id);
            }
          });
        }

        // 채널 상태 업데이트
        mediaStore.setChannelInfo(channelId, type);

        // 초기 미디어 상태 설정
        updateState({
          muted: mediaStore.isMuted,
          deafened: mediaStore.isDeafened,
          camera_on: !mediaStore.isCameraOff,
          screen_sharing: mediaStore.isScreenSharing
        });
      }
      return success;
    },
    [connection, mediaStore, mediaChatStore.currentUserId]
  );

  const leaveCurrentChannel = useCallback(async () => {
    if (!connection || !mediaStore.channelId) return;

    // WebRTC 연결 정리
    webrtc.closeAllConnections();

    // 스트림 정리
    if (mediaChatStore.currentUserId) {
      const userState = mediaChatStore.userStates.get(mediaChatStore.currentUserId);
      if (userState?.stream) {
        userState.stream.getTracks().forEach(track => track.stop());
      }
      if (userState?.screenStream) {
        userState.screenStream.getTracks().forEach(track => track.stop());
      }
      mediaChatStore.setStream(mediaChatStore.currentUserId, null);
      mediaChatStore.setStream(mediaChatStore.currentUserId, null, true);
    }

    // 서버에 채널 퇴장 알림
    connection.leaveChannel();

    // 로컬 상태 초기화
    mediaStore.resetState();
    userStore.resetState();
    mediaChatStore.resetState();
  }, [connection, mediaStore.channelId, mediaChatStore.currentUserId]);

  const updateState = useCallback(
    (update: VoiceStateUpdate) => {
      if (!connection) return;

      // 로컬 상태 업데이트
      if ('muted' in update) mediaStore.setMuted(update.muted ?? false);
      if ('deafened' in update) mediaStore.setDeafened(update.deafened ?? false);
      if ('camera_on' in update) mediaStore.setCameraOff(!update.camera_on);
      if ('screen_sharing' in update) mediaStore.setScreenSharing(update.screen_sharing ?? false);

      // 현재 사용자의 상태도 업데이트
      if (mediaChatStore.currentUserId) {
        mediaChatStore.updateUserState(mediaChatStore.currentUserId, {
          muted: update.muted,
          deafened: update.deafened,
          cameraOn: update.camera_on,
          screenSharing: update.screen_sharing,
        });
      }

      // 서버에 상태 업데이트 전송
      connection.updateState(update);
    },
    [connection, mediaChatStore.currentUserId]
  );

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      leaveCurrentChannel();
    };
  }, [leaveCurrentChannel]);

  return {
    joinChannel,
    leaveChannel: leaveCurrentChannel,
    updateState,
    isInChannel: !!mediaStore.channelId,
    currentChannelId: mediaStore.channelId,
    currentChannelType: mediaStore.channelType,
  };
}