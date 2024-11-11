// VideoControls.tsx
import { ControlButton } from '../Voice/ControlButton';
import { Camera, CameraOff, HeadphoneOff, Headphones, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface VideoControlsProps {
  show: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const voiceChatStore = useVoiceChat();

  // 각 유저별 상태를 추적하기 위한 ref
  const userStatesRef = useRef(new Map<string, {
    muted: boolean;
    deafened: boolean;
    camera_on: boolean;
    screen_sharing: boolean;
  }>());

  // 채널 입장 시 초기 상태 설정
  useEffect(() => {
    if (currentUser) {
      // 채널 입장 시 항상 false로 초기화
      userStatesRef.current.set(currentUser.user_id, {
        muted: false,
        deafened: false,
        camera_on: false,
        screen_sharing: false
      });

      // VoiceChat 스토어도 동일하게 초기화
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        muted: false,
        deafened: false,
        camera_on: false,
        screen_sharing: false
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
        deafened: false,
        camera_on: false,
        screen_sharing: false
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
        deafened: false,
        camera_on: false,
        screen_sharing: false
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

  const handleToggleCamera = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 현재 유저의 최신 상태 가져오기
      const currentState = userStatesRef.current.get(currentUser.user_id) || {
        muted: false,
        deafened: false,
        camera_on: false,
        screen_sharing: false
      };

      // 새로운 상태 계산
      const newState = {
        ...currentState,
        camera_on: !currentState.camera_on,
        screen_sharing: false // 카메라를 켤 때는 화면 공유를 끔
      };

      // 상태 업데이트
      userStatesRef.current.set(currentUser.user_id, newState);

      // 서버에 상태 전송
      connection.updateState(newState);

      // UI 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        camera_on: newState.camera_on,
        screen_sharing: false
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  const handleToggleScreenShare = useCallback(() => {
    if (connection && currentUser) {
      if (!connection.isInChannel()) {
        console.log('Not in a channel yet');
        return;
      }

      // 현재 유저의 최신 상태 가져오기
      const currentState = userStatesRef.current.get(currentUser.user_id) || {
        muted: false,
        deafened: false,
        camera_on: false,
        screen_sharing: false
      };

      // 새로운 상태 계산
      const newState = {
        ...currentState,
        screen_sharing: !currentState.screen_sharing,
        camera_on: false // 화면 공유를 켤 때는 카메라를 끔
      };

      // 상태 업데이트
      userStatesRef.current.set(currentUser.user_id, newState);

      // 서버에 상태 전송
      connection.updateState(newState);

      // UI 업데이트
      voiceChatStore.updateUserStatus(currentUser.user_id, {
        ...currentUser,
        screen_sharing: newState.screen_sharing,
        camera_on: false
      });
    }
  }, [connection, currentUser, voiceChatStore]);

  // 현재 유저의 상태만 참조하도록 수정
  const currentUserState = useMemo(() => {
    if (!currentUser) return null;

    const userState = userStatesRef.current.get(currentUser.user_id) || {
      muted: false,
      deafened: false,
      camera_on: false,
      screen_sharing: false
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
        icon={currentUserState?.camera_on ? Camera : CameraOff}
        onClick={handleToggleCamera}
        tooltip={currentUserState?.camera_on ? 'Turn Off Camera' : 'Turn On Camera'}
        active={!currentUserState?.camera_on}
      />
      <ControlButton
        icon={currentUserState?.screen_sharing ? MonitorOff : MonitorUp}
        onClick={handleToggleScreenShare}
        tooltip={currentUserState?.screen_sharing ? 'Stop Sharing' : 'Share Screen'}
        active={currentUserState?.screen_sharing}
      />
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
      <ControlButton
        icon={PhoneOff}
        onClick={handleDisconnect}
        tooltip="Disconnect"
        className="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
};