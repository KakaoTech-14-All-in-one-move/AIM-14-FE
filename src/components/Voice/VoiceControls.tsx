import { ControlButton } from '@/components/Voice/ControlButton';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useCallback, useEffect } from 'react';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

  // 현재 사용자의 상태만 가져오기
  const currentUserState = useVoiceChat(state => {
    if (!currentUser?.user_id) return null;
    return state.userStates.get(currentUser.user_id) || null;
  });

  // 컴포넌트 마운트 시 현재 사용자 ID 설정
  useEffect(() => {
    if (currentUser) {
      voiceChatStore.setCurrentUserId(currentUser.user_id);
      // 초기 상태 설정
      if (!voiceChatStore.userStates.has(currentUser.user_id)) {
        voiceChatStore.updateUserState(currentUser.user_id, {
          muted: false,
          deafened: false,
          speaking: false,
          stream: null,
        });
      }
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
    if (!connection || !currentUser || !currentUserState) return;

    const newMutedState = !currentUserState.muted;
    const webrtc = WebRTCConnection.getInstance();
    webrtc.toggleAudio(!newMutedState);

    connection.updateState({ muted: newMutedState });
    voiceChatStore.updateUserState(currentUser.user_id, { muted: newMutedState });
  }, [connection, currentUser, currentUserState]);

  const handleToggleDeafen = useCallback(() => {
    if (!connection || !currentUser || !currentUserState || !connection.isInChannel()) return;

    const newDeafenedState = !currentUserState.deafened;
    const webrtc = WebRTCConnection.getInstance();
    webrtc.toggleDeafened(newDeafenedState);

    connection.updateState({ deafened: newDeafenedState });
    voiceChatStore.updateUserState(currentUser.user_id, { deafened: newDeafenedState });
  }, [connection, currentUser, currentUserState]);

  // 현재 사용자가 없거나 상태가 없으면 렌더링하지 않음
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