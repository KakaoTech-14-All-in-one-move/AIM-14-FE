import { Camera, CameraOff, HeadphoneOff, Headphones, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useMediaChat } from '@/hooks/useMediaChat';
import { ControlButton } from './ControlButton';

interface VoiceControlsProps {
  show: boolean;
  isVideo?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show, isVideo = false }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const mediaChat = useMediaChat();

  // 현재 사용자의 상태 가져오기
  const currentUserState = mediaChat.userStates.get(currentUser?.user_id || '');

  const handleDisconnect = () => {
    if (connection) {
      if (currentUserState?.screenSharing) {
        mediaChat.toggleScreenShare();
      }
      connection.leaveChannel();
      mediaChat.resetState();
    }
    navigate('/home');
  };

  // 현재 사용자 상태가 없으면 렌더링하지 않음
  if (!currentUser || !currentUserState) return null;

  const canShareScreen = () => {
    if (!isVideo) return false;
    // 다른 사용자가 이미 화면 공유 중인지 확인
    const otherUserSharing = Array.from(mediaChat.userStates.entries()).some(
      ([userId, state]) => userId !== currentUser.user_id && state.screenSharing,
    );
    return !otherUserSharing;
  };

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
        transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <ControlButton
        icon={currentUserState.muted ? MicOff : Mic}
        onClick={mediaChat.toggleMute}
        tooltip={currentUserState.muted ? 'Unmute' : 'Mute'}
        active={currentUserState.muted}
      />

      <ControlButton
        icon={currentUserState.deafened ? HeadphoneOff : Headphones}
        onClick={mediaChat.toggleDeafen}
        tooltip={currentUserState.deafened ? 'Undeafen' : 'Deafen'}
        active={currentUserState.deafened}
      />

      {isVideo && (
        <>
          <ControlButton
            icon={!currentUserState.cameraOn ? CameraOff : Camera}
            onClick={mediaChat.toggleCamera}
            tooltip={!currentUserState.cameraOn ? 'Turn On Camera' : 'Turn Off Camera'}
            active={!currentUserState.cameraOn}
          />

          <ControlButton
            icon={currentUserState.screenSharing ? MonitorOff : MonitorUp}
            onClick={mediaChat.toggleScreenShare}
            tooltip={currentUserState.screenSharing ? 'Stop Sharing' : 'Share Screen'}
            active={currentUserState.screenSharing}
            disabled={!canShareScreen() && !currentUserState.screenSharing}
          />
        </>
      )}

      <ControlButton
        icon={PhoneOff}
        onClick={handleDisconnect}
        tooltip="Disconnect"
        className="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
};