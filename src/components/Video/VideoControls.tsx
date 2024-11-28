import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';
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
import { ControlButton } from '../Voice/ControlButton';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection.ts';

interface VideoControlsProps {
  show: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

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
      const videoEnabled = !currentUser.camera_on;

      // 화면 공유 중이라면 전환 확인
      if (videoEnabled && currentUser.screen_sharing) {
        const confirmSwitch = window.confirm(
          '화면 공유를 중단하고 카메라를 활성화하시겠습니까?',
        );
        if (!confirmSwitch) return;

        // 화면 공유 중단
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // 화면 공유 VideoBox 제거
        voiceChatStore.removeUser(currentUser.user_id + '_screen');

        connection.updateState({
          screen_sharing: false,
        });
      }

      if (videoEnabled) {
        // 카메라 켜기
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

        // WebRTC 연결에 비디오 트랙 추가
        const webrtc = WebRTCConnection.getInstance();
        await webrtc.replaceVideoTrack(stream.getVideoTracks()[0]);

        connection.updateState({
          camera_on: true,
          screen_sharing: false,
        });

        voiceChatStore.updateUserStatus(currentUser.user_id, {
          camera_on: true,
          screen_sharing: false,
          stream,
        });
      } else {
        // 카메라 끄기
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;

          // WebRTC 연결에서 비디오 트랙 제거
          const webrtc = WebRTCConnection.getInstance();
          await webrtc.initializePresenter(null);
          await webrtc.removeVideoTrack();
        }

        connection.updateState({
          camera_on: false,
        });

        voiceChatStore.updateUserStatus(currentUser.user_id, {
          camera_on: false,
          stream: null,
        });
      }
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      if ((error as Error).name === 'NotAllowedError') {
        alert('카메라 접근 권한이 거부되었습니다.');
      } else {
        alert('카메라를 시작하는데 문제가 발생했습니다.');
      }
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleScreenShare = useCallback(async () => {
    if (!connection || !currentUser) return;

    try {
      const screenSharingEnabled = !currentUser.screen_sharing;

      if (screenSharingEnabled) {
        // 화면 공유 시작
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        // 화면 공유가 중단되었을 때 자동으로 상태 업데이트
        displayStream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };

        // 기존 카메라 스트림 중지
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }

        screenStreamRef.current = displayStream;

        // WebRTC 연결에 화면 공유 트랙 추가
        const webrtc = WebRTCConnection.getInstance();
        await webrtc.initializePresenter(null);
        await webrtc.replaceVideoTrack(displayStream.getVideoTracks()[0]);

        // 서버 상태 업데이트
        connection.updateState({
          screen_sharing: true,
          camera_on: false,
        });

        // 새로운 화면 공유 VideoBox를 위한 상태 업데이트
        voiceChatStore.addUser({
          ...currentUser,
          user_id: currentUser.user_id + '_screen',
          screen_sharing: true,
          camera_on: false,
          stream: displayStream,
        });

        voiceChatStore.updateUserStatus(currentUser.user_id, {
          camera_on: false,
          screen_sharing: false,
          stream: null,  // 기존 카메라 스트림 제거
        });

      } else {
        // 화면 공유 중지
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // 화면 공유 VideoBox 제거
        voiceChatStore.removeUser(currentUser.user_id + '_screen');

        connection.updateState({
          screen_sharing: false,
        });

        voiceChatStore.updateUserStatus(currentUser.user_id, {
          screen_sharing: false,
        });
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleMute = useCallback(() => {
    if (!connection || !currentUser) return;
    if (!connection.isInChannel()) {
      console.log('Not in a channel yet');
      return;
    }

    // 서버 상태 업데이트
    connection.updateState({
      muted: !currentUser.muted,
    });

    // 로컬 상태 업데이트
    voiceChatStore.updateUserStatus(currentUser.user_id, {
      ...currentUser,
      muted: !currentUser.muted,
    });
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleDeafen = useCallback(() => {
    if (!connection || !currentUser) return;
    if (!connection.isInChannel()) {
      console.log('Not in a channel yet');
      return;
    }

    // 서버 상태 업데이트
    connection.updateState({
      deafened: !currentUser.deafened,
    });

    // 로컬 상태 업데이트
    voiceChatStore.updateUserStatus(currentUser.user_id, {
      ...currentUser,
      deafened: !currentUser.deafened,
    });
  }, [connection, currentUser, voiceChatStore]);

  const handleDisconnect = useCallback(() => {
    if (!connection) return;

    // 모든 미디어 스트림 정리
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      screenStreamRef.current = null;
    }

    // WebRTC 연결 정리
    const webrtc = WebRTCConnection.getInstance();
    webrtc.dispose(); // WebRTC 연결과 모든 미디어 트랙을 정리

    // VoiceChat 스토어 상태 초기화
    if (currentUser) {
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        camera_on: false,
        screen_sharing: false,
        stream: null,
      });
    }

    connection.leaveChannel();
    navigate('/home');
  }, [connection, navigate, currentUser, voiceChatStore]);

  return (
    <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2
transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <ControlButton
        icon={currentUser?.camera_on ? Camera : CameraOff}
        onClick={handleToggleCamera}
        tooltip={currentUser?.camera_on ? 'Turn Off Camera' : 'Turn On Camera'}
        active={!currentUser?.camera_on}
      />
      <ControlButton
        icon={currentUser?.muted ? MicOff : Mic}
        onClick={handleToggleMute}
        tooltip={currentUser?.muted ? 'Unmute' : 'Mute'}
        active={currentUser?.muted}
      />
      <ControlButton
        icon={currentUser?.deafened ? HeadphoneOff : Headphones}
        onClick={handleToggleDeafen}
        tooltip={currentUser?.deafened ? 'Undeafen' : 'Deafen'}
        active={currentUser?.deafened}
      />
      <ControlButton
        icon={currentUser?.screen_sharing ? MonitorOff : MonitorUp}
        onClick={handleToggleScreenShare}
        tooltip={currentUser?.screen_sharing ? 'Stop Sharing' : 'Share Screen'}
        active={currentUser?.screen_sharing}
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