import { ControlButton } from './ControlButton.tsx';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '../../services/call/CallProvider.tsx';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useCallback, useEffect } from 'react';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

  // VoiceChat store와 현재 유저 상태 동기화
  useEffect(() => {
    if (currentUser) {
      voiceChatStore.updateUserStatus(currentUser.user_id, currentUser);
    }
  }, [currentUser]);

  const handleDisconnect = useCallback(() => {
    if (connection) {
      connection.leaveChannel();
    }
    navigate('/home');
  }, [connection, navigate]);

  const handleToggleMute = useCallback(() => {
    if (connection && currentUser) {
      // 현재 채널과 유저 상태 확인
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      const newMutedState = !currentUser.muted;

      // UI 상태 즉시 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        muted: newMutedState
      });

      // 서버에 상태 업데이트 전송
      connection.updateState({
        muted: newMutedState,
        deafened: currentUser.deafened
      });

      console.log('Mute state updated:', {
        userId: currentUser.user_id,
        newState: newMutedState
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleDeafen = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      const newDeafenedState = !currentUser.deafened;

      // UI 상태 즉시 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        deafened: newDeafenedState,
        // 귀머거리 상태가 되면 자동으로 음소거도 활성화
        muted: newDeafenedState ? true : currentUser.muted
      });

      // 서버에 상태 업데이트 전송
      connection.updateState({
        muted: newDeafenedState ? true : currentUser.muted,
        deafened: newDeafenedState
      });

      console.log('Deafen state updated:', {
        userId: currentUser.user_id,
        newState: newDeafenedState
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  // 현재 유저의 상태 가져오기
  const currentUserState = voiceChatStore.users.find(
    u => u.user_id === currentUser?.user_id
  ) || currentUser;

  console.log('Current user state:', currentUserState);

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
       transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <ControlButton
        icon={currentUserState?.muted ? MicOff : Mic}
        onClick={handleToggleMute}
        tooltip={currentUserState?.muted ? 'Unmute' : 'Mute'}
        active={currentUserState?.muted}
      />
      <ControlButton
        icon={currentUserState?.deafened ? HeadphoneOff : Headphones}
        onClick={handleToggleDeafen}
        tooltip={currentUserState?.deafened ? 'Undeafen' : 'Deafen'}
        active={currentUserState?.deafened}
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