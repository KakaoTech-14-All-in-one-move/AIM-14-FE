import { Camera, CameraOff, HeadphoneOff, Headphones, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useMediaChat } from '@/hooks/useMediaChat';
import { ControlButton } from './ControlButton';
import { useCallback } from 'react';

interface VideoControlsProps {
  show: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const mediaChat = useMediaChat();

  // 현재 사용자의 상태 가져오기
  const userState = mediaChat.userStates.get(currentUser?.user_id ?? '');

  const handleDisconnect = useCallback(() => {
    if (connection) {
      if (userState?.screenSharing) {
        mediaChat.toggleScreenShare();
      }
      connection.leaveChannel();
      mediaChat.resetState();
    }
    navigate('/home');
  }, [connection, userState?.screenSharing, mediaChat, navigate]);

  // 화면 공유 가능 여부 체크
  const canShareScreen = useCallback(() => {
    if (!userState || !currentUser) return false;

    // 카메라가 켜져 있으면 화면 공유 불가
    if (userState.cameraOn) return false;

    // 이미 다른 사용자가 화면 공유 중인지 확인
    const otherUserSharing = Array.from(mediaChat.userStates.entries()).some(
      ([userId, state]) => userId !== currentUser.user_id && state.screenSharing
    );

    return !otherUserSharing;
  }, [userState, currentUser, mediaChat.userStates]);

  if (!currentUser || !userState) return null;

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2
        transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <ControlButton
        icon={userState.cameraOn ? Camera : CameraOff}
        onClick={mediaChat.toggleCamera}
        tooltip={userState.cameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        active={userState.cameraOn}
        disabled={userState.screenSharing}
      />

      <ControlButton
        icon={userState.muted ? MicOff : Mic}
        onClick={mediaChat.toggleMute}
        tooltip={userState.muted ? 'Unmute' : 'Mute'}
        active={userState.muted}
      />

      <ControlButton
        icon={userState.deafened ? HeadphoneOff : Headphones}
        onClick={mediaChat.toggleDeafen}
        tooltip={userState.deafened ? 'Undeafen' : 'Deafen'}
        active={userState.deafened}
      />

      <ControlButton
        icon={userState.screenSharing ? MonitorOff : MonitorUp}
        onClick={mediaChat.toggleScreenShare}
        tooltip={userState.screenSharing ? 'Stop Screen Share' : 'Share Screen'}
        active={userState.screenSharing}
        disabled={!canShareScreen() && !userState.screenSharing}
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