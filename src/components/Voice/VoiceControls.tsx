// VoiceControls.tsx
import { ControlButton } from './ControlButton.tsx';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '../../services/call/CallProvider.tsx';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection, currentUser } = useCall();

  const handleDisconnect = () => {
    if (connection) {
      connection.leaveChannel();
    }
    navigate('/home');
  };

  const handleToggleMute = () => {
    if (connection && currentUser) {
      connection.updateState({ muted: !currentUser.muted });
    }
  };

  const handleToggleDeafen = () => {
    if (connection && currentUser) {
      connection.updateState({ deafened: !currentUser.deafened });
    }
  };

  return (
    <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
      transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>
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
      {location.pathname.includes('/video/') && (
        <>
          {/* 비디오 관련 컨트롤 */}
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