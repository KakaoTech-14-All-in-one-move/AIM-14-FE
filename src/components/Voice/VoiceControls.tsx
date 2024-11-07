import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff, MonitorUp, Video, VideoOff } from 'lucide-react';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { ControlButton } from './ControlButton';
import { useCall } from '../../services/call/CallProvider';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoiceChat();
  const { connection, currentUser } = useCall();
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  const [isCameraOn, setIsCameraOn] = React.useState(false);

  const handleDisconnect = () => {
    if (connection) {
      connection.leaveChannel();
    }
    navigate('/home');
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        connection?.updateState({ screenSharing: true });
      } else {
        setIsScreenSharing(false);
        connection?.updateState({ screenSharing: false });
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const handleToggleMute = () => {
    toggleMute();
    connection?.updateState({ muted: !isMuted });
  };

  const handleToggleDeafen = () => {
    toggleDeafen();
    connection?.updateState({ deafened: !isDeafened });
  };

  const handleToggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    connection?.updateState({ cameraOn: !isCameraOn });
  };

  return (
    <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
      transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <ControlButton
        icon={isMuted ? MicOff : Mic}
        onClick={handleToggleMute}
        tooltip={isMuted ? 'Unmute' : 'Mute'}
        active={isMuted}
      />
      <ControlButton
        icon={isDeafened ? HeadphoneOff : Headphones}
        onClick={handleToggleDeafen}
        tooltip={isDeafened ? 'Undeafen' : 'Deafen'}
        active={isDeafened}
      />
      {location.pathname.includes('/video/') && (
        <>
          <ControlButton
            icon={isCameraOn ? Video : VideoOff}
            onClick={handleToggleCamera}
            tooltip={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            active={isCameraOn}
          />
          <ControlButton
            icon={MonitorUp}
            onClick={handleScreenShare}
            tooltip={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            active={isScreenSharing}
            className={isScreenSharing ? 'bg-green-500 hover:bg-green-600' : undefined}
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