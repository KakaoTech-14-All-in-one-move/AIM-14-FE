import { ControlButton } from '@/components/Voice/ControlButton.tsx';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider.tsx';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useCallback, useEffect } from 'react';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection.ts';
import { UserState } from '@/components/Voice/types/voice.ts';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

  useEffect(() => {
    if (currentUser) {
      const initialState: UserState = {
        muted: false,
        deafened: false,
        speaking: false,
        stream: null,
      };
      voiceChatStore.updateUserState(currentUser.user_id, initialState);
    }
  }, [currentUser?.user_id]);

  const handleDisconnect = useCallback(() => {
    if (connection) {
      connection.leaveChannel();
      voiceChatStore.resetState();
    }
    navigate('/home');
  }, [connection, navigate]);

  const handleToggleMute = useCallback(() => {
    if (!connection || !currentUser) return;

    const newState = {
      muted: !voiceChatStore.userStates.get(currentUser.user_id)?.muted,
    };

    const webrtc = WebRTCConnection.getInstance();
    webrtc.toggleAudio(!newState.muted);
    connection.updateState(newState);
  }, [connection, currentUser]);

  const handleToggleDeafen = useCallback(() => {
    if (!connection || !currentUser || !connection.isInChannel()) return;

    const newState = {
      deafened: !voiceChatStore.userStates.get(currentUser.user_id)?.deafened,
    };

    const webrtc = WebRTCConnection.getInstance();
    webrtc.toggleDeafened(newState.deafened);
    connection.updateState(newState);
  }, [connection, currentUser]);

  const currentUserState = currentUser
    ? voiceChatStore.userStates.get(currentUser.user_id)
    : null;

  if (!currentUser || !currentUserState) return null;

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
        transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        z-20`}
    >
      <ControlButton
        icon={currentUserState.muted ? MicOff : Mic}
        onClick={handleToggleMute}
        tooltip={currentUserState.muted ? 'Unmute' : 'Mute'}
        active={currentUserState.muted}
      />
      <ControlButton
        icon={currentUserState.deafened ? HeadphoneOff : Headphones}
        onClick={handleToggleDeafen}
        tooltip={currentUserState.deafened ? 'Undeafen' : 'Deafen'}
        active={currentUserState.deafened}
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