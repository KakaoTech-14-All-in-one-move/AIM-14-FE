import { HeadphoneOff, MicOff } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import React, { useEffect, useRef } from 'react';
import { ChannelUser } from '@/stores/userChannelStore';

interface UserBoxProps {
  user: ChannelUser;
  isScreenShare?: boolean;
}

export const UserBox: React.FC<UserBoxProps> = React.memo(({ user, isScreenShare = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL

  useEffect(() => {
    if (!videoRef.current) return;

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;
    if (stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = user.mediaState.isMuted || user.mediaState.isDeafened;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [
    user.mediaState.stream,
    user.mediaState.screenStream,
    isScreenShare,
    user.mediaState.isMuted,
    user.mediaState.isDeafened,
  ]);

  const showVideo = isScreenShare ? Boolean(user.mediaState.screenStream) : user.mediaState.isCameraOn;

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg transition-all duration-200 
        ${user.mediaState.isSpeaking && !user.mediaState.isMuted ? 'ring-2 ring-green-500' : ''}`}
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
              src={BASE_URL + user.profileImage}
              alt={user.username}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <DefaultProfileImage username={user.username} size={80} />
          )}
        </div>
      )}

      {/* 상태 아이콘 */}
      <div className="absolute top-4 right-4 flex gap-2">
        {user.mediaState.isMuted && (
          <div className="bg-red-500/90 rounded-full p-3">
            <MicOff className="w-7 h-7 text-white" />
          </div>
        )}
        {user.mediaState.isDeafened && (
          <div className="bg-red-500/90 rounded-full p-3">
            <HeadphoneOff className="w-7 h-7 text-white" />
          </div>
        )}
      </div>

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-lg font-medium">
            {user.username}
            {isScreenShare && '\'s Screen'}
          </span>
        </div>
      </div>
    </div>
  );
});