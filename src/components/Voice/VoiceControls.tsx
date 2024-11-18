import { ControlButton } from '@/components/Voice/ControlButton.tsx';
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider.tsx';
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

  // 각 유저별 상태를 추적하기 위한 ref
  const userStatesRef = useRef(new Map<string, { muted: boolean; deafened: boolean }>());

  // 채널 입장 시 초기 상태 설정
  useEffect(() => {
    if (currentUser) {
      // 채널 입장 시 항상 false로 초기화
      userStatesRef.current.set(currentUser.user_id, {
        muted: false,
        deafened: false
      });

      // VoiceChat 스토어도 동일하게 초기화
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        muted: false,
        deafened: false
      });
    }
  }, [currentUser?.user_id]); // currentUser가 변경될 때만 실행

  const handleDisconnect = useCallback(() => {
    if (connection) {
      connection.leaveChannel();
      // 채널 떠날 때 상태 초기화
      userStatesRef.current.clear();
    }
    navigate('/home');
  }, [connection, navigate]);

  const handleToggleMute = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 현재 유저의 최신 상태 가져오기
      const currentState = userStatesRef.current.get(currentUser.user_id) || {
        muted: false,
        deafened: false
      };

      // 새로운 상태 계산
      const newState = {
        ...currentState,
        muted: !currentState.muted
      };

      // 상태 업데이트
      userStatesRef.current.set(currentUser.user_id, newState);

      // 서버에 상태 전송
      connection.updateState(newState);

      // UI 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        muted: newState.muted
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleDeafen = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 현재 유저의 최신 상태 가져오기
      const currentState = userStatesRef.current.get(currentUser.user_id) || {
        muted: false,
        deafened: false
      };

      // 새로운 상태 계산
      const newState = {
        ...currentState,
        deafened: !currentState.deafened
      };

      // 상태 업데이트
      userStatesRef.current.set(currentUser.user_id, newState);

      // 서버에 상태 전송
      connection.updateState(newState);

      // UI 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        deafened: newState.deafened
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  // 현재 유저의 상태만 참조하도록 수정
  const currentUserState = useMemo(() => {
    if (!currentUser) return null;

    const userState = userStatesRef.current.get(currentUser.user_id) || {
      muted: false,
      deafened: false
    };

    return {
      ...currentUser,
      ...userState
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