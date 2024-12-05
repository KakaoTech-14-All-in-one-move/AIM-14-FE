import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useMediaChat } from '@/hooks/useMediaChat';
import { ControlButton } from './ControlButton';

interface VoiceControlsProps {
  show: boolean;
  isVideo?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const {
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    leaveChannel,
  } = useMediaChat();

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
        transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
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
        icon={PhoneOff}
        onClick={leaveChannel}
        tooltip="연결 종료"
        className="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
};