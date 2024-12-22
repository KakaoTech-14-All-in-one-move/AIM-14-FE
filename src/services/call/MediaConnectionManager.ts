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
      // 1. 기본 체크
      if (!MediaConnectionManager.getCallConnection()) {
        console.error('No CallConnection available');
        return false;
      }

      // CallConnection이 있다는 것이 보장되므로 바로 설정
      this.mediaServer.setCallConnection(MediaConnectionManager.getCallConnection()!);

      const currentUser = useAuthStore.getState().user;
      if (!currentUser?.user_id) {
        console.error('Invalid user data:', currentUser);
        return false;
      }

      const userId = currentUser.user_id.toString();
      console.log('Joining channel for user:', userId);

      // 2. 서버 연결
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

      // 3. 현재 채널 정리
      const currentChannel = useUserChannelStore.getState().currentUserChannel;
      if (currentChannel.channelId) {
        console.log('Leaving current channel before joining new one');
        await this.leaveChannel();
      }

      // 4. 마이크 권한 확인
      console.log('Checking microphone permissions');
      const hasPermission = await this.checkMicrophonePermission();
      if (!hasPermission) {
        console.log('Failed to get microphone permission');
        return false;
      }

      // 5. 오디오 스트림 획득
      console.log('Getting audio stream');
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });


        if (!audioStream || audioStream.getAudioTracks().length === 0) {
          throw new Error('오디오 스트림을 가져올 수 없습니다.');
        }

        await this.mediaServer.replaceStream(audioStream);
      } catch (error: any) {
        let errorMessage = '마이크 연결에 실패했습니다.';
        if (error.name === 'NotAllowedError') {
          errorMessage = '마이크 접근이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '마이크를 찾을 수 없습니다. 마이크가 제대로 연결되어 있는지 확인해주세요.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = '마이크에 접근할 수 없습니다. 다른 앱에서 사용 중인지 확인해주세요.';
        }

        alert(errorMessage);
        console.error('Error getting audio stream:', error);
        await this.handleFailedJoin();
        return false;
      }

      // 6. 초기 상태 설정
      console.log('Setting up initial channel state');
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
        stream: audioStream,
      });

      // 7. WebRTC 연결
      console.log('Establishing WebRTC connections');
      try {
        const currentUserId = useAuthStore.getState().user?.user_id.toString();
        if (!currentUserId) {
          throw new Error('User ID not found');
        }

        // 자신과 다른 참가자들과의 connection 생성
        await this.mediaServer.connectToAllUsers(channelId, audioStream);
        console.log('WebRTC connections established successfully');
      } catch (error) {
        if (import.meta.env.VITE_ENV === 'dev') {
          console.log('Development environment: Ignoring WebRTC connection error');
        } else {
          console.error('Failed to establish WebRTC connections:', error);
          await this.handleFailedJoin();
          return false;
        }
      }

      // 8. 최종 미디어 상태 업데이트
      console.log('Setting up final media state');
      const initialMediaState = {
        stream: audioStream,
        screenStream: null,
        isMuted: false,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
      };

      this.userStateManager.handleUserStateUpdate(channelId, userId, initialMediaState);
      this.notifyStateUpdate(channelId);
      console.log('Successfully joined channel:', channelId);
      return true;

    } catch (error) {
      console.error('Error joining channel:', error);
      await this.handleFailedJoin();
      return false;
    }
  }

  private async checkMicrophonePermission(): Promise<boolean> {
    // console.log('Checking microphone permissions');
    try {
      // 먼저 navigator.permissions로 현재 권한 상태 확인
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      // console.log('Current microphone permission status:', permissionStatus.state);

      if (permissionStatus.state === 'denied') {
        alert('마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        return false;
      }

      // 권한이 granted가 아닌 경우 직접 getUserMedia 호출하여 권한 요청
      if (permissionStatus.state !== 'granted') {
        console.log('Requesting microphone permission explicitly');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        // 테스트 스트림 정리
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted successfully');
        return true;
      }

      return true;
    } catch (error: any) {
      console.error('Permission check failed:', error);

      // 사용자가 이해하기 쉬운 오류 메시지 표시
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('마이크 접근이 거부되었습니다. 음성 채팅을 위해서는 마이크 권한이 필요합니다.');
      } else if (error.name === 'NotFoundError') {
        alert('마이크를 찾을 수 없습니다. 마이크가 제대로 연결되어 있는지 확인해주세요.');
      } else {
        alert('마이크 권한 확인 중 오류가 발생했습니다. 브라우저 설정을 확인해주세요.');
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
          isMuted: true,
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
              await this.mediaServer.handleCameraState(false);
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
          const streamUpdate = await this.mediaServer.handleCameraState(updates.isCameraOn);
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
