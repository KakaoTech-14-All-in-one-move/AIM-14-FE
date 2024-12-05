import { Camera, CameraOff, HeadphoneOff, Headphones, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff } from 'lucide-react';
import { useCallback } from 'react';
import { useMediaChat } from '@/hooks/useMediaChat';
import { ControlButton } from './ControlButton';
import { useAuthStore } from '@/stores/authStore';
import { useUserChannelStore } from '@/stores/userChannelStore';

interface VideoControlsProps {
  show: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const { user } = useAuthStore();
  const { channelUsers, currentUserChannel } = useUserChannelStore();
  const {
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    leaveChannel
  } = useMediaChat();

  // 화면 공유 가능 여부 체크
  const canShareScreen = useCallback(() => {
    if (!user?.email || !currentUserChannel.channelId) return false;

    // 카메라가 켜져 있으면 화면 공유 불가
    if (isCameraOn) return false;

    // 현재 채널의 사용자들 가져오기
    const currentUsers = channelUsers.get(currentUserChannel.channelId) || [];

    // 이미 다른 사용자가 화면 공유 중인지 확인
    const otherUserSharing = currentUsers.some(
      channelUser => channelUser.userId !== user.email && channelUser.mediaState.isScreenSharing
    );

    return !otherUserSharing;
  }, [user, currentUserChannel.channelId, channelUsers, isCameraOn]);

  if (!user) return null;

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2
        transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <ControlButton
        icon={isCameraOn ? Camera : CameraOff}
        onClick={toggleCamera}
        tooltip={isCameraOn ? '카메라 끄기' : '카메라 켜기'}
        active={isCameraOn}
        disabled={isScreenSharing}
      />

      <ControlButton
        icon={isMuted ? MicOff : Mic}
        onClick={toggleMute}
        tooltip={isMuted ? '음소거 해제' : '음소거'}
        active={isMuted}
      />

      <ControlButton
        icon={isDeafened ? HeadphoneOff : Headphones}
        onClick={toggleDeafen}
        tooltip={isDeafened ? '스피커 음소거 해제' : '스피커 음소거'}
        active={isDeafened}
      />

      <ControlButton
        icon={isScreenSharing ? MonitorOff : MonitorUp}
        onClick={toggleScreenShare}
        tooltip={isScreenSharing ? '화면 공유 중지' : '화면 공유'}
        active={isScreenSharing}
        disabled={!canShareScreen() && !isScreenSharing}
      />

      <ControlButton
        icon={PhoneOff}
        onClick={leaveChannel}
        tooltip="연결 종료"
        className="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
};