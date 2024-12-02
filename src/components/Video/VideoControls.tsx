import { useNavigate } from 'react-router-dom';
import { useCall } from '@/services/call/CallProvider';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useCallback, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
} from 'lucide-react';
import { ControlButton } from '../Video/ControlButton';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection';
import { VideoControlsProps } from '@/components/Video/types/video';

export const VideoControls: React.FC<VideoControlsProps> = ({ show }) => {
  const navigate = useNavigate();
  const { connection, currentUser } = useCall();
  const videoChatStore = useVideoChat();
  const currentUserState = useVideoChat(state =>
    currentUser ? state.userStates.get(currentUser.user_id) : null
  );

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (currentUser) {
      videoChatStore.setCurrentUserId(currentUser.user_id);
      if (!videoChatStore.userStates.has(currentUser.user_id)) {
        videoChatStore.updateUserState(currentUser.user_id, {
          muted: false,
          deafened: false,
          speaking: false,
          cameraOn: false,
          screenSharing: false,
          stream: null,
        });
      }
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    };
  }, [currentUser?.user_id]);

  const handleToggleCamera = useCallback(async () => {
    if (!connection || !currentUser || !currentUserState) return;

    try {
      const newCameraState = !currentUserState.cameraOn;

      if (newCameraState) {
        if (currentUserState.screenSharing) {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        localStreamRef.current = stream;

        const webrtc = WebRTCConnection.getInstance();
        await webrtc.replaceVideoTrack(stream.getVideoTracks()[0]);

        await connection.updateState({
          camera_on: true,
          screen_sharing: false,
        });

        videoChatStore.updateUserState(currentUser.user_id, {
          cameraOn: true,
          screenSharing: false,
          stream: stream
        });
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();

          await connection.updateState({
            camera_on: false,
          });

          videoChatStore.updateUserState(currentUser.user_id, {
            cameraOn: false,
            stream: null
          });
        }
      }
    } catch (error) {
      console.error('Camera toggle error:', error);
    }
  }, [connection, currentUser, currentUserState]);

  const handleToggleScreenShare = useCallback(async () => {
    if (!connection || !currentUser || !currentUserState) return;

    try {
      const newScreenShareState = !currentUserState.screenSharing;

      if (newScreenShareState) {
        if (currentUserState.cameraOn) {
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
          }

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();

          await connection.updateState({
            camera_on: false,
          });

          videoChatStore.updateUserState(currentUser.user_id, {
            cameraOn: false,
            stream: null
          });
        }

        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        displayStream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };

        screenStreamRef.current = displayStream;

        const webrtc = WebRTCConnection.getInstance();
        await webrtc.replaceVideoTrack(displayStream.getVideoTracks()[0]);

        await connection.updateState({
          screen_sharing: true,
          camera_on: false,
        });

        videoChatStore.updateUserState(currentUser.user_id, {
          screenSharing: true,
          cameraOn: false,
          stream: displayStream
        });
      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;

          const webrtc = WebRTCConnection.getInstance();
          await webrtc.removeVideoTrack();

          await connection.updateState({
            screen_sharing: false,
          });

          videoChatStore.updateUserState(currentUser.user_id, {
            screenSharing: false,
            stream: null
          });
        }
      }
    } catch (error) {
      console.error('Screen share toggle error:', error);
    }
  }, [connection, currentUser, currentUserState]);

  const handleToggleMute = useCallback(() => {
    if (!connection || !currentUser || !currentUserState) return;

    const newMutedState = !currentUserState.muted;

    connection.updateState({
      muted: newMutedState,
    });

    videoChatStore.updateUserState(currentUser.user_id, {
      muted: newMutedState
    });
  }, [connection, currentUser, currentUserState]);

  const handleToggleDeafen = useCallback(() => {
    if (!connection || !currentUser || !currentUserState) return;

    const newDeafenedState = !currentUserState.deafened;

    connection.updateState({
      deafened: newDeafenedState,
    });

    videoChatStore.updateUserState(currentUser.user_id, {
      deafened: newDeafenedState
    });
  }, [connection, currentUser, currentUserState]);

  const handleDisconnect = useCallback(() => {
    if (!connection || !currentUser) return;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    videoChatStore.updateUserState(currentUser.user_id, {
      cameraOn: false,
      screenSharing: false,
      stream: null
    });

    videoChatStore.resetState();
    connection.leaveChannel();
    navigate('/home');
  }, [connection, currentUser, navigate]);

  if (!currentUser || !currentUserState) return null;

  return (
    <div
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2
        transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <ControlButton
        icon={currentUserState.cameraOn ? Camera : CameraOff}
        onClick={handleToggleCamera}
        tooltip={currentUserState.cameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        active={currentUserState.cameraOn}
        disabled={currentUserState.screenSharing}
      />
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
        icon={currentUserState.screenSharing ? MonitorOff : MonitorUp}
        onClick={handleToggleScreenShare}
        tooltip={currentUserState.screenSharing ? 'Stop Screen Share' : 'Share Screen'}
        active={currentUserState.screenSharing}
        disabled={currentUserState.cameraOn}
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