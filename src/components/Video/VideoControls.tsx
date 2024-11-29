import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useCallback, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
} from 'lucide-react';
import { ControlButton } from '../Video/ControlButton';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { VideoControlsProps } from '@/components/Video/types/video';

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const videoChatStore = useVideoChat();

  // 비디오/오디오 스트림 ref
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // 초기화 및 클린업
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 모든 스트림 정리
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    };
  }, []);

  const handleToggleCamera = useCallback(async () => {
    if (!connection || !currentUser) return;

    try {
      const videoEnabled = !videoChatStore.isCameraOn;

      if (videoEnabled) {
        // 화면 공유 중지 로직...
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        localStreamRef.current = stream;

        // WebRTC 설정
        const webrtc = WebRTCConnection.getInstance();
        await webrtc.replaceVideoTrack(stream.getVideoTracks()[0]);

        // 중요: 서버 상태 업데이트를 기다림
        await connection.updateState({
          camera_on: true,
          screen_sharing: false,
        });

        // Store 업데이트를 Promise로 래핑
        const updateStore = () => new Promise<void>(resolve => {
          const userData = {
            user_id: currentUser.user_id,
            username: currentUser.username,
            server_id: currentUser.server_id,
            camera_on: true,
            screen_sharing: false,
            stream: stream,
            speaking: false,
            muted: false,
            deafened: false,
            channel_id: currentUser.channel_id,
            channel_type: currentUser.channel_type,
            profile_image: currentUser.profile_image,
          };

          // 순서 중요: 먼저 사용자 정보를 업데이트
          videoChatStore.addUser(userData);

          // 그 다음 카메라 상태 토글
          videoChatStore.toggleCamera();

          // 상태 업데이트 확인을 위한 timeout
          setTimeout(() => {
            videoChatStore.users.find(u => u.user_id === currentUser.user_id);
            resolve();
          }, 0);
        });

        await updateStore();

      } else {
        // 카메라 중지 로직도 동일한 패턴 적용
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();

          // 서버 상태 업데이트를 기다림
          await connection.updateState({
            camera_on: false,
          });

          // Store 업데이트를 Promise로 래핑
          await new Promise<void>(resolve => {
            videoChatStore.updateUserStatus(currentUser.user_id, {
              camera_on: false,
              stream: null,
            });
            videoChatStore.toggleCamera();

            setTimeout(() => {
              resolve();
            }, 0);
          });
        }
      }
    } catch (error) {
      console.error('Camera toggle error:', error);
    }
  }, [connection, currentUser, videoChatStore]);

  const handleToggleScreenShare = useCallback(async () => {
    if (!connection || !currentUser) return;

    try {
      const screenSharingEnabled = !videoChatStore.isScreenSharing;

      if (screenSharingEnabled) {
        // 카메라가 켜져있으면 먼저 끄기
        if (videoChatStore.isCameraOn) {
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
          }

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();

          // 카메라 끄기 상태 서버에 전송
          connection.updateState({
            camera_on: false,
          });

          videoChatStore.updateUserStatus(currentUser.user_id, {
            camera_on: false,
            stream: null,
          });
          videoChatStore.toggleCamera();
        }

        // 화면 공유 시작
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        // 화면 공유 종료 이벤트 핸들러
        displayStream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };

        screenStreamRef.current = displayStream;

        const webrtc = WebRTCConnection.getInstance();
        await webrtc.replaceVideoTrack(displayStream.getVideoTracks()[0]);

        // 서버 상태 업데이트
        connection.updateState({
          screen_sharing: true,
          camera_on: false,
        });

        // 화면 공유 비디오 박스 추가
        const screenShareUser = {
          ...currentUser,
          user_id: currentUser.user_id + '_screen',
          screen_sharing: true,
          camera_on: false,
          stream: displayStream,
        };

        // VideoChat store 상태 업데이트
        videoChatStore.addUser(screenShareUser);
        videoChatStore.toggleScreenShare();

      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();
        }

        // 화면 공유 사용자 제거
        videoChatStore.removeUser(currentUser.user_id + '_screen');

        // 서버 상태 업데이트
        connection.updateState({
          screen_sharing: false,
        });

        // 로컬 상태 업데이트
        videoChatStore.updateUserStatus(currentUser.user_id, {
          screen_sharing: false,
        });
        videoChatStore.toggleScreenShare();
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [connection, currentUser, videoChatStore]);

  const handleToggleMute = useCallback(() => {
    if (!connection || !currentUser) return;
    if (!connection.isInChannel()) {
      console.log('Not in a channel yet');
      return;
    }

    connection.updateState({
      muted: !videoChatStore.isMuted,
    });

    videoChatStore.updateUserStatus(currentUser.user_id, {
      muted: !videoChatStore.isMuted,
    });
    videoChatStore.toggleMute();
  }, [connection, currentUser, videoChatStore]);

  const handleToggleDeafen = useCallback(() => {
    if (!connection || !currentUser) return;
    if (!connection.isInChannel()) {
      console.log('Not in a channel yet');
      return;
    }

    connection.updateState({
      deafened: !videoChatStore.isDeafened,
    });

    videoChatStore.updateUserStatus(currentUser.user_id, {
      deafened: !videoChatStore.isDeafened,
    });
    videoChatStore.toggleDeafen();
  }, [connection, currentUser, videoChatStore]);

  const handleDisconnect = useCallback(() => {
    if (!connection) return;

    // 1. 모든 스트림 정리
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // 2. 상태 초기화
    if (currentUser) {
      videoChatStore.updateUserStatus(currentUser.user_id, {
        camera_on: false,
        screen_sharing: false,
        stream: null,
      });
    }

    // 3. store 전체 초기화
    videoChatStore.resetState();

    // 4. 채널 나가기
    connection.leaveChannel();
    navigate('/home');
  }, [connection, navigate, currentUser, videoChatStore]);

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2
        transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <ControlButton
        icon={videoChatStore.isCameraOn ? Camera : CameraOff}
        onClick={handleToggleCamera}
        tooltip={videoChatStore.isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        active={videoChatStore.isCameraOn}
        disabled={videoChatStore.isScreenSharing}
      />
      <ControlButton
        icon={videoChatStore.isMuted ? MicOff : Mic}
        onClick={handleToggleMute}
        tooltip={videoChatStore.isMuted ? 'Unmute' : 'Mute'}
        active={videoChatStore.isMuted}
      />
      <ControlButton
        icon={videoChatStore.isDeafened ? HeadphoneOff : Headphones}
        onClick={handleToggleDeafen}
        tooltip={videoChatStore.isDeafened ? 'Undeafen' : 'Deafen'}
        active={videoChatStore.isDeafened}
      />
      <ControlButton
        icon={videoChatStore.isScreenSharing ? MonitorOff : MonitorUp}
        onClick={handleToggleScreenShare}
        tooltip={videoChatStore.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        active={videoChatStore.isScreenSharing}
        disabled={videoChatStore.isCameraOn}
      />
      <ControlButton
        icon={PhoneOff}
        onClick={handleDisconnect}
        tooltip="Disconnect"
        className="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
};