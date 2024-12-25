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

  static getCallConnection(): CallConnection | null {
    return MediaConnectionManager.callConnection;
  }

  setCallConnection(connection: CallConnection) {
    MediaConnectionManager.callConnection = connection;
  }

  private notifyStateUpdate(channelId: string | null) {
    this.stateUpdateCallbacks.forEach((callback) => callback(channelId));
  }

  async joinChannel(channelId: string, type: MediaType): Promise<boolean> {
    try {
      // 1. 기본 체크 (변경 없음)
      if (!MediaConnectionManager.getCallConnection()) {
        console.error('No CallConnection available');
        return false;
      }

      const currentUser = useAuthStore.getState().user;
      if (!currentUser?.user_id) {
        console.error('Invalid user data:', currentUser);
        return false;
      }

      // 2. 현재 채널 정리 (변경 없음)
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        console.log('Leaving current channel before joining new one');
        await this.leaveChannel();
      }

      // 3. 마이크 및 카메라 권한 확인
      console.log('Checking media permissions');
      const hasPermission = await this.checkMediaPermissions(type);
      if (!hasPermission) {
        console.log('Failed to get media permissions');
        return false;
      }

      // 4. 오디오/비디오 스트림 획득 (채널 타입에 따라 다르게 처리)
      console.log('Getting media stream for channel type:', type);
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          // VIDEO 채널인 경우에만 비디오 활성화
          ...(type === 'VIDEO' && {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          })
        });

        if (!mediaStream || (mediaStream.getAudioTracks().length === 0)) {
          throw new Error('미디어 스트림을 가져올 수 없습니다.');
        }

        await this.mediaServer.replaceStream(mediaStream);
      } catch (error: any) {
        let errorMessage = '미디어 연결에 실패했습니다.';
        if (error.name === 'NotAllowedError') {
          errorMessage = `${type === 'VIDEO' ? '카메라/' : ''}마이크 접근이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.`;
        } else if (error.name === 'NotFoundError') {
          errorMessage = `${type === 'VIDEO' ? '카메라/' : ''}마이크를 찾을 수 없습니다. 장치가 제대로 연결되어 있는지 확인해주세요.`;
        } else if (error.name === 'NotReadableError') {
          errorMessage = `${type === 'VIDEO' ? '카메라/' : ''}마이크에 접근할 수 없습니다. 다른 앱에서 사용 중인지 확인해주세요.`;
        }
        alert(errorMessage);
        await this.handleFailedJoin();
        return false;
      }

      // 5. 채널 입장 웹소켓 요청 (변경 없음)
      console.log('Attempting to join channel via CallConnection');
      try {
        const success = await MediaConnectionManager.getCallConnection()!.joinChannel(channelId, type);
        if (!success) {
          console.error('Failed to join channel via CallConnection');
          await this.handleFailedJoin();
          return false;
        }
        console.log('Successfully joined channel via CallConnection');
      } catch (error) {
        console.error('Error during CallConnection joinChannel:', error);
        await this.handleFailedJoin();
        return false;
      }

      // 6. 초기 상태 설정 (채널 타입에 따라 camera_on 설정)
      console.log('Setting up initial channel state');
      useUserChannelStore.getState().setCurrentUserChannel(channelId, type);
      this.userStateManager.handleUserJoin(channelId, {
        user_id: currentUser.user_id.toString(),
        username: currentUser.username,
        profile_image: currentUser.profile_image,
        channel_id: channelId,
        muted: false,
        deafened: false,
        camera_on: type === 'VIDEO', // VIDEO 채널인 경우에만 true
        screen_sharing: false,
        stream: mediaStream,
      });

      return true;
    } catch (error) {
      console.error('Error joining channel:', error);
      await this.handleFailedJoin();
      return false;
    }
  }

  // checkMediaPermissions 메서드 추가
  private async checkMediaPermissions(type: MediaType): Promise<boolean> {
    try {
      // 채널 타입에 따라 필요한 권한 확인
      const permissionQueries = [
        await navigator.permissions.query({ name: 'microphone' as PermissionName }),
        ...(type === 'VIDEO' ? [await navigator.permissions.query({ name: 'camera' as PermissionName })] : [])
      ];

      const permissions = await Promise.all(permissionQueries);

      if (permissions.some(permission => permission.state === 'denied')) {
        const errorMessage = type === 'VIDEO'
          ? '카메라 또는 마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
          : '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.';
        alert(errorMessage);
        return false;
      }

      // 권한이 granted가 아닌 경우 직접 getUserMedia 호출하여 권한 요청
      if (permissions.some(permission => permission.state !== 'granted')) {
        console.log('Requesting media permissions explicitly');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'VIDEO' // VIDEO 채널일 때만 비디오 권한 요청
        });

        // 테스트 스트림 정리
        stream.getTracks().forEach(track => track.stop());
        console.log(`${type} channel media permissions granted successfully`);
        return true;
      }

      return true;
    } catch (error: any) {
      console.error('Permission check failed:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const errorMessage = type === 'VIDEO'
          ? '카메라/마이크 접근이 거부되었습니다. 영상 채팅을 위해서는 카메라와 마이크 권한이 필요합니다.'
          : '마이크 접근이 거부되었습니다. 음성 채팅을 위해서는 마이크 권한이 필요합니다.';
        alert(errorMessage);
      } else if (error.name === 'NotFoundError') {
        const errorMessage = type === 'VIDEO'
          ? '카메라/마이크를 찾을 수 없습니다. 장치가 제대로 연결되어 있는지 확인해주세요.'
          : '마이크를 찾을 수 없습니다. 마이크가 제대로 연결되어 있는지 확인해주세요.';
        alert(errorMessage);
      } else {
        const errorMessage = type === 'VIDEO'
          ? '미디어 권한 확인 중 오류가 발생했습니다. 브라우저 설정을 확인해주세요.'
          : '마이크 권한 확인 중 오류가 발생했습니다. 브라우저 설정을 확인해주세요.';
        alert(errorMessage);
      }

      return false;
    }
  }

  private async handleFailedJoin() {
    console.log('Cleaning up after failed join attempt');
    await this.leaveChannel();

    // 필요한 경우 추가적인 정리 작업 수행
    try {
      const currentStream = this.mediaServer.getLocalStream();
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async leaveChannel() {
    try {
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (!currentChannel.channelId) return;

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      const userId = currentUser.user_id.toString();

      // 1. 현재 사용자의 미디어 상태를 가져옴
      const currentUserState = useUserChannelStore
        .getState()
        .channelUsers.get(currentChannel.channelId)
        ?.find(user => user.userId === userId);

      if (currentUserState) {
        // 2. UserStateManager를 통해 미디어 상태 초기화
        const clearMediaState = {
          stream: null,
          screenStream: null,
          isMuted: false,
          isDeafened: false,
          isCameraOn: false,
          isScreenSharing: false,
        };

        this.userStateManager.handleUserStateUpdate(
          currentChannel.channelId,
          userId,
          clearMediaState,
        );
      }

      // 3. 모든 활성 미디어 트랙을 찾아서 정리
      const cleanupAllMediaTracks = () => {
        if (currentUserState?.mediaState.stream) {
          currentUserState.mediaState.stream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
        }
        if (currentUserState?.mediaState.screenStream) {
          currentUserState.mediaState.screenStream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
        }
      };

      // 4. 먼저 모든 미디어 트랙 정리
      cleanupAllMediaTracks();

      // 5. MediaServer 연결 정리
      this.mediaServer.disconnect();

      // 6. 소켓 연결 정리
      MediaConnectionManager.getCallConnection()?.leaveChannel();

      // 7. UserStateManager를 통해 사용자 퇴장 처리
      this.userStateManager.handleUserLeave(
        currentChannel.channelId,
        userId,
      );

      // 8. 채널 상태 초기화
      useUserChannelStore.getState().setCurrentUserChannel(null, null);

      // 9. 한번 더 실행하여 누락된 트랙이 없도록 보장
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

      if (!currentUserChannel.channelId || !currentUser) {
        console.warn('No active channel or user');
        return;
      }

      const userId = currentUser.user_id.toString();
      const channelId = currentUserChannel.channelId;

      // 현재 상태 가져오기
      const currentUserState = useUserChannelStore.getState().channelUsers
        .get(channelId)
        ?.find((user) => user.userId === userId);

      if (!currentUserState) {
        console.warn('Current user state not found');
        return;
      }

      // 상태 업데이트 준비
      const mediaStateUpdates: Partial<MediaState> = {};
      const serverUpdates = {
        muted: currentUserState.mediaState.isMuted,
        deafened: currentUserState.mediaState.isDeafened,
        camera_on: currentUserState.mediaState.isCameraOn,
        screen_sharing: currentUserState.mediaState.isScreenSharing,
      };

      console.log('serverUpdates, updates', serverUpdates, updates);

      // 각 상태 변경 처리
      try {
        // 1. 카메라 상태 변경
        if ('isCameraOn' in updates) {
          console.log('Processing camera state update:', updates.isCameraOn);

          const streamUpdate = await this.mediaServer.handleCameraState(updates.isCameraOn);

          if (streamUpdate.stream) {
            console.log('Camera state update result:', {
              hasStream: !!streamUpdate.stream,
              stream: streamUpdate.stream,
            });

            mediaStateUpdates.stream = streamUpdate.stream;
            mediaStateUpdates.isCameraOn = updates.isCameraOn;
            serverUpdates.camera_on = updates.isCameraOn;
          } else if (updates.isCameraOn) {
            // 카메라를 켜려고 했는데 실패한 경우
            console.warn('Failed to get camera stream');
            await this.rollbackCameraState(channelId, userId, true);
            return;
          } else {
            // 카메라를 끄는 경우
            mediaStateUpdates.isCameraOn = false;
            serverUpdates.camera_on = false;
          }
        }

        // 2. 화면 공유 상태 변경
        if ('isScreenSharing' in updates) {
          console.log('Processing screen share update:', updates.isScreenSharing);

          if (updates.isScreenSharing) {
            // 카메라가 켜져있으면 먼저 끄기
            if (currentUserState.mediaState.isCameraOn) {
              await this.mediaServer.handleCameraState(false);
              mediaStateUpdates.isCameraOn = false;
              serverUpdates.camera_on = false;
            }

            const stream = await this.mediaServer.startScreenShare();
            if (!stream) {
              console.warn('Failed to start screen sharing');
              await this.rollbackScreenShareState(channelId, userId, serverUpdates);
              return;
            }

            stream.getVideoTracks()[0].onended = () => {
              this.updateMediaState({ isScreenSharing: false });
            };

            mediaStateUpdates.screenStream = stream;
            mediaStateUpdates.isScreenSharing = true;
            serverUpdates.screen_sharing = true;
          } else {
            await this.mediaServer.stopScreenShare();
            mediaStateUpdates.screenStream = null;
            mediaStateUpdates.isScreenSharing = false;
            serverUpdates.screen_sharing = false;
          }
        }

        // 3. 오디오 상태 변경
        if ('isMuted' in updates || 'isDeafened' in updates) {
          if ('isMuted' in updates && currentUserState.mediaState.stream) {
            await this.mediaServer.toggleAudio(!updates.isMuted);
            mediaStateUpdates.isMuted = updates.isMuted;
            serverUpdates.muted = updates.isMuted;
          }

          if ('isDeafened' in updates) {
            mediaStateUpdates.isDeafened = updates.isDeafened;
            serverUpdates.deafened = updates.isDeafened;
          }
        }

        // 4. 로컬 상태 업데이트
        console.log('Updating local media state:', mediaStateUpdates);
        this.userStateManager.handleUserStateUpdate(
          channelId,
          userId,
          mediaStateUpdates
        );

        // 5. 서버 상태 업데이트
        console.log('Sending server updates:', serverUpdates);
        await MediaConnectionManager.getCallConnection()?.updateState(serverUpdates);

      } catch (error) {
        console.error('Error during media state update:', error);
        // 에러 발생 시 이전 상태로 롤백
        const rollbackState = {
          ...currentUserState.mediaState,
          ...('isCameraOn' in updates ? { isCameraOn: !updates.isCameraOn } : {}),
          ...('isScreenSharing' in updates ? { isScreenSharing: !updates.isScreenSharing } : {}),
        };

        this.userStateManager.handleUserStateUpdate(
          channelId,
          userId,
          rollbackState
        );
        throw error;
      }
    } catch (error) {
      console.error('Fatal error in updateMediaState:', error);
      throw error;
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
