import { ControlButton } from './ControlButton.tsx';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '../../services/call/CallProvider.tsx';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface VoiceControlsProps {
  show: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

  // 현재 유저의 마지막 상태를 참조하기 위한 ref
  const latestStateRef = useRef({
    muted: currentUser?.muted || false,
    deafened: currentUser?.deafened || false
  });

  // 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    if (currentUser) {
      latestStateRef.current = {
        muted: currentUser.muted,
        deafened: currentUser.deafened
      };
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
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 최신 상태를 기반으로 업데이트
      const newMutedState = !latestStateRef.current.muted;
      latestStateRef.current.muted = newMutedState;

      // 서버에 현재 누적된 전체 상태 전송
      connection.updateState({
        muted: latestStateRef.current.muted,
        deafened: latestStateRef.current.deafened
      });

      // 임시 UI 업데이트 (서버 응답 전)
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        muted: newMutedState
      });

      console.log('Requested state update:', {
        userId: currentUser.user_id,
        newState: latestStateRef.current
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleDeafen = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 최신 상태를 기반으로 업데이트
      const newDeafenedState = !latestStateRef.current.deafened;
      latestStateRef.current.deafened = newDeafenedState;

      // 서버에 현재 누적된 전체 상태 전송
      connection.updateState({
        muted: latestStateRef.current.muted,
        deafened: latestStateRef.current.deafened
      });

      // 임시 UI 업데이트 (서버 응답 전)
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        deafened: newDeafenedState
      });

      console.log('Requested state update:', {
        userId: currentUser.user_id,
        newState: latestStateRef.current
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  // currentUser와 store의 상태를 병합하여 최신 상태 사용
  const currentUserState = useMemo(() => {
    const storeUser = voiceChatStore.users.find(u => u.user_id === currentUser?.user_id);
    return {
      ...currentUser,
      ...storeUser,
      ...latestStateRef.current
    };
  }, [currentUser, voiceChatStore.users]);

  return (
    <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 
     transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>
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