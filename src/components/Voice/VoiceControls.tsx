// src/components/Voice/VoiceControls.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff, MonitorUp } from 'lucide-react';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { ControlButton } from './ControlButton';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoiceChat();

  // location path를 체크하여 현재 채널 타입 확인
  const isVideoChannel = location.pathname.includes('/video/');
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);

  const handleDisconnect = () => {
    navigate('/home');
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
      } else {
        // 화면 공유 중지 로직
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
        transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <ControlButton
        icon={isMuted ? MicOff : Mic}
        onClick={toggleMute}
        tooltip={isMuted ? 'Unmute' : 'Mute'}
        active={isMuted}
      />
      <ControlButton
        icon={isDeafened ? HeadphoneOff : Headphones}
        onClick={toggleDeafen}
        tooltip={isDeafened ? 'Undeafen' : 'Deafen'}
        active={isDeafened}
      />
      {isVideoChannel && (
        <ControlButton
          icon={MonitorUp}
          onClick={handleScreenShare}
          tooltip={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          active={isScreenSharing}
          className={isScreenSharing ? 'bg-green-500 hover:bg-green-600' : undefined}
        />
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