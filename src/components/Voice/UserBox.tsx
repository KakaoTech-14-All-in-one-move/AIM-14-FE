import { HeadphoneOff, MicOff, CameraOff, MonitorUp } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import React, { useRef, useEffect } from 'react';
import { useMediaChat } from '@/hooks/useMediaChat';
import { MediaUser } from '@/types/media';

interface UserBoxProps {
  user: MediaUser;
  isScreenShare?: boolean;
}

export const UserBox: React.FC<UserBoxProps> = React.memo(({ user, isScreenShare = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaChat = useMediaChat();
  const userState = mediaChat.userStates.get(user.userId);
  const isSpeaking = mediaChat.speakingUsers.has(user.userId);

  useEffect(() => {
    if (!videoRef.current || !userState) return;

    const stream = isScreenShare ? userState.screenStream : userState.stream;
    if (stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = userState.muted || userState.deafened;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [userState?.stream, userState?.screenStream, isScreenShare, userState?.muted, userState?.deafened]);

  if (!userState) return null;

  const showVideo = isScreenShare ? Boolean(userState.screenStream) : userState.cameraOn;

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg transition-all duration-200 
        ${isSpeaking && !userState.muted && !isScreenShare ? 'ring-2 ring-green-500 animate-pulse' : ''}
        ${isScreenShare ? 'col-span-2' : ''}`}
    >
      {/* 비디오 스트림 */}
      {showVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      )}

      {/* 프로필 이미지 영역 */}
      {!showVideo && !isScreenShare && (
        <div className="absolute inset-0 flex items-center justify-center">
          {user.profileImage ? (
            <img
              src={import.meta.env.VITE_BE_SERVER_URL + user.profileImage}
              alt={user.username}
              className="w-28 h-28 rounded-full"
            />
          ) : (
            <DefaultProfileImage username={user.username} size={80} margin="mr-2" />
          )}
        </div>
      )}

      {/* 상태 아이콘 */}
      <div className="absolute top-4 right-4 flex gap-2">
        {userState.muted && (
          <div className="bg-red-500/90 rounded-full p-2">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {!userState.muted && isSpeaking && !isScreenShare && (
          <div className="bg-green-500/90 rounded-full p-2">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {userState.deafened && (
          <div className="bg-red-500/90 rounded-full p-2">
            <HeadphoneOff className="w-4 h-4 text-white" />
          </div>
        )}
        {!userState.cameraOn && !isScreenShare && (
          <div className="bg-red-500/90 rounded-full p-2">
            <CameraOff className="w-4 h-4 text-white" />
          </div>
        )}
        {userState.screenSharing && !isScreenShare && (
          <div className="bg-green-500/90 rounded-full p-2">
            <MonitorUp className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-lg font-medium">
            {user.username}
            {isScreenShare && "'s Screen"}
          </span>
        </div>
      </div>
    </div>
  );
});