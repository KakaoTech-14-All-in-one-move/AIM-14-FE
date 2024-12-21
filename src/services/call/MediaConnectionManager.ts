import { MediaState, MediaType } from './types';
import { MediaServerConnection } from './webrtc/MediaServerConnection';
import { CallConnection } from './socket/callConnection';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { useAuthStore } from '@/stores/authStore';
import { UserStateManager } from '@/services/call/UserStateManager';

export class MediaConnectionManager {
  private static instance: MediaConnectionManager | null = null;
  private static callConnection: CallConnection | null = null;
  private mediaServer: MediaServerConnection;
  private stateUpdateCallbacks: Set<(channelId: string | null) => void>;
  private userStateManager: UserStateManager;
  private screenShareStream: MediaStream | null = null;

  private constructor() {
    this.mediaServer = MediaServerConnection.getInstance();
    this.userStateManager = UserStateManager.getInstance();
    this.stateUpdateCallbacks = new Set();
  }

  static getInstance(): MediaConnectionManager {
    if (!this.instance) {
      this.instance = new MediaConnectionManager();
    }
    return this.instance;
  }

  setCallConnection(connection: CallConnection) {
    MediaConnectionManager.callConnection = connection;
    this.mediaServer.setCallConnection(connection);
  }

  static getCallConnection(): CallConnection | null {
    return MediaConnectionManager.callConnection;
  }

  private notifyStateUpdate(channelId: string | null) {
    this.stateUpdateCallbacks.forEach((callback) => callback(channelId));
  }

  async joinChannel(channelId: string, type: MediaType): Promise<boolean> {
    try {
      // CallConnection 확인
      if (!MediaConnectionManager.getCallConnection()) {
        console.error('No CallConnection available');
        return false;
      }

      // 현재 채널 확인 및 정리
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        await this.leaveChannel();
      }

      // CallConnection을 통한 채널 참가
      console.log('Attempting to join channel via CallConnection...');
      const success = await MediaConnectionManager.getCallConnection()!.joinChannel(
        channelId,
        type,
      );
      if (!success) {
        console.error('Failed to join channel via CallConnection');
        return false;
      }

      // WebRTC 연결 준비
      console.log('Preparing WebRTC connection...');
      try {
        await this.mediaServer.prepareConnection(channelId);
      } catch (error) {
        console.error('Failed to prepare WebRTC connection:', error);
        return false;
      }

      // 오디오 스트림 획득
      console.log('Getting audio stream...');
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!stream) {
          console.error('Failed to get audio stream - stream is null');
          return false;
        }

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.error('Failed to get audio stream - no audio tracks');
          return false;
        }

        console.log('Successfully got audio stream with tracks:', audioTracks.length);
        this.mediaServer.replaceStream(stream);
      } catch (error: any) {
        console.error('Failed to get initial audio stream:', error);
        let errorMessage = '오디오 스트림을 가져오는데 실패했습니다.';

        if (error instanceof DOMException) {
          switch (error.name) {
            case 'NotAllowedError':
              errorMessage =
                '마이크 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.';
              break;
            case 'NotFoundError':
              errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
              break;
            case 'NotReadableError':
              errorMessage = '마이크에 접근할 수 없습니다. 다른 앱에서 사용 중일 수 있습니다.';
              break;
          }
        }

        alert(errorMessage);
        return false;
      }

      // WebRTC 연결 수립
      console.log('Establishing WebRTC connection...');
      try {
        await this.mediaServer.connect();
      } catch (error) {
        console.error('Failed to establish WebRTC connection:', error);
        return false;
      }

      // 현재 사용자 정보 확인
      const currentUser = useAuthStore.getState().user;
      console.log('Current user data:', currentUser);

      if (!currentUser || !currentUser.user_id) {
        console.error('No current user found or invalid user data');
        return false;
      }

      const userId = currentUser.user_id.toString();
      console.log('User ID:', userId);

      // 채널 및 사용자 상태 설정
      try {
        useUserChannelStore.getState().setCurrentUserChannel(channelId, type);
        this.userStateManager.handleUserJoin(channelId, {
          user_id: userId,
          username: currentUser.username,
          profile_image: currentUser.profile_image,
          channel_id: channelId,
          muted: false,
          deafened: false,
          camera_on: false,
          screen_sharing: false,
        });
      } catch (error) {
        console.error('Error setting user state:', error);
        return false;
      }

      console.log('Successfully joined channel:', channelId);
      this.notifyStateUpdate(channelId);
      return true;
    } catch (error) {
      console.error('Error joining channel:', error);
      await this.leaveChannel();
      return false;
    }
  }
  async leaveChannel() {
    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (!currentChannel.channelId) return;

      // 1. 모든 활성 미디어 트랙을 찾아서 정리
      const cleanupAllMediaTracks = () => {
        // 현재 채널의 모든 사용자의 스트림 정리
        const channelUsers =
          useUserChannelStore.getState().channelUsers.get(currentChannel.channelId!) || [];
        channelUsers.forEach((user) => {
          // 일반 스트림 정리
          if (user.mediaState.stream) {
            user.mediaState.stream.getTracks().forEach((track) => {
              track.enabled = false;
              track.stop();
            });
          }
          // 스크린 쉐어 스트림 정리
          if (user.mediaState.screenStream) {
            user.mediaState.screenStream.getTracks().forEach((track) => {
              track.enabled = false;
              track.stop();
            });
          }
        });
      };

      // 2. 먼저 모든 미디어 트랙 정리
      cleanupAllMediaTracks();

      // 3. MediaServer 연결 정리
      this.mediaServer.disconnect();

      // 4. 소켓 연결 정리
      MediaConnectionManager.getCallConnection()?.leaveChannel();

      // 5. 상태 정리
      const userState = useUserChannelStore
        .getState()
        .channelUsers.get(currentChannel.channelId)
        ?.find((user) => user.userId === useAuthStore.getState().user?.email);

      if (userState) {
        this.userStateManager.handleUserLeave(
          currentChannel.channelId,
          useAuthStore.getState().user?.email || '',
        );
      }

      // 6. 채널 정리
      useUserChannelStore.getState().setCurrentUserChannel(null, null);

      // 7. 한번 더 실행하여 누락된 트랙이 없도록 보장
      setTimeout(cleanupAllMediaTracks, 200);

      this.notifyStateUpdate(null);
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  }

  async updateMediaState(updates: Partial<MediaState>) {
    try {
      const { currentUserChannel } = useUserChannelStore.getState();
      const currentUser = useAuthStore.getState().user;

      if (!currentUserChannel.channelId || !currentUser) return;

      // 현재 상태 가져오기
      const channelUsers = useUserChannelStore.getState().channelUsers;
      const currentUserState = channelUsers
        .get(currentUserChannel.channelId)
        ?.find((user) => user.userId === currentUser.user_id.toString());

      if (!currentUserState) return;

      // 서버에 전송할 업데이트 준비
      const serverUpdates = {
        muted: 'isMuted' in updates ? updates.isMuted : currentUserState.mediaState.isMuted,
        deafened:
          'isDeafened' in updates ? updates.isDeafened : currentUserState.mediaState.isDeafened,
        camera_on:
          'isCameraOn' in updates ? updates.isCameraOn : currentUserState.mediaState.isCameraOn,
        screen_sharing:
          'isScreenSharing' in updates
            ? updates.isScreenSharing
            : currentUserState.mediaState.isScreenSharing,
      };

      // 상태 업데이트를 위한 배치 작업
      const mediaStateUpdates: Partial<MediaState> = {};

      // 화면 공유 상태 변경 처리
      if ('isScreenSharing' in updates) {
        try {
          if (updates.isScreenSharing === true) {
            // 카메라가 켜져있으면 먼저 끄기
            if (currentUserState.mediaState.isCameraOn) {
              mediaStateUpdates.isCameraOn = false;
              await this.handleCameraState(false);
            }

            // 화면 공유 시작
            const stream = await this.mediaServer.startScreenShare();

            if (!stream) {
              await this.rollbackScreenShareState(
                currentUserChannel.channelId,
                currentUser.user_id.toString(),
                serverUpdates,
              );
              return;
            }

            // 화면 공유 종료 이벤트 핸들러
            stream.getVideoTracks()[0].onended = () => {
              this.updateMediaState({ isScreenSharing: false });
            };

            mediaStateUpdates.screenStream = stream;
            mediaStateUpdates.isScreenSharing = true;
          } else {
            // 화면 공유 중지
            await this.mediaServer.stopScreenShare();
            mediaStateUpdates.screenStream = null;
            mediaStateUpdates.isScreenSharing = false;
          }
        } catch (error) {
          console.error('Error in screen share:', error);
          await this.rollbackScreenShareState(
            currentUserChannel.channelId,
            currentUser.user_id.toString(),
            serverUpdates,
          );
          throw error;
        }
      }

      // 카메라 상태 변경 처리
      if ('isCameraOn' in updates) {
        try {
          const streamUpdate = await this.handleCameraState(updates.isCameraOn);
          mediaStateUpdates.stream = streamUpdate.stream;
          mediaStateUpdates.isCameraOn = updates.isCameraOn;
        } catch (error) {
          console.error('Failed to toggle camera:', error);
          await this.rollbackCameraState(
            currentUserChannel.channelId,
            currentUser.user_id.toString(),
            updates.isCameraOn,
          );
          return;
        }
      }

      // 음소거/음성 차단 상태 변경 처리
      if ('isMuted' in updates || 'isDeafened' in updates) {
        const channelUser = channelUsers
          .get(currentUserChannel.channelId)
          ?.find((user) => user.userId === currentUser.user_id.toString());

        if (channelUser?.mediaState.stream) {
          if ('isMuted' in updates) {
            await this.mediaServer.toggleAudio(!updates.isMuted);
            mediaStateUpdates.isMuted = updates.isMuted;
          }
          if ('isDeafened' in updates) {
            mediaStateUpdates.isDeafened = updates.isDeafened;
          }
        }
      }

      // 모든 상태 변경을 한 번에 적용
      const finalState = {
        ...serverUpdates,
        ...mediaStateUpdates,
      };

      // 로컬 상태 업데이트
      this.userStateManager.handleUserStateUpdate(
        currentUserChannel.channelId,
        currentUser.user_id.toString(),
        finalState,
      );

      // 서버에 상태 업데이트 전송
      await MediaConnectionManager.getCallConnection()?.updateState(serverUpdates);
    } catch (error) {
      console.error('Error updating media state:', error);
      throw error;
    }
  }

  // 카메라 상태 처리를 위한 헬퍼 메소드
  private async handleCameraState(isCameraOn: boolean) {
    if (isCameraOn) {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      await this.mediaServer.replaceStream(videoStream);
      return { stream: videoStream };
    } else {
      const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      await this.mediaServer.replaceStream(audioOnlyStream);
      return { stream: audioOnlyStream };
    }
  }

  // 화면 공유 상태 롤백
  private async rollbackScreenShareState(channelId: string, userId: string, serverUpdates: any) {
    const rollbackState = {
      ...serverUpdates,
      isScreenSharing: false,
      screenStream: null,
    };
    this.userStateManager.handleUserStateUpdate(channelId, userId, rollbackState);
    await MediaConnectionManager.getCallConnection()?.updateState({
      ...serverUpdates,
      screen_sharing: false,
    });
  }

  // 카메라 상태 롤백
  private async rollbackCameraState(channelId: string, userId: string, isCameraOn: boolean) {
    const rollbackState = {
      isCameraOn: !isCameraOn,
    };
    this.userStateManager.handleUserStateUpdate(channelId, userId, rollbackState);
  }

  dispose() {
    if (this.screenShareStream) {
      this.screenShareStream.getTracks().forEach((track) => track.stop());
      this.screenShareStream = null;
    }
    this.mediaServer.dispose();
    this.stateUpdateCallbacks.clear();
    MediaConnectionManager.instance = null;
  }
}
