import { HeadphoneOff, MicOff } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import React, { useEffect, useRef, useMemo } from 'react';
import { ChannelUser } from '@/stores/userChannelStore';

interface UserBoxProps {
  user: ChannelUser;
  isScreenShare?: boolean;
  totalUsers: number;
}

export const UserBox: React.FC<UserBoxProps> = React.memo(({
  user,
  isScreenShare = false,
  totalUsers
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const BASE_URL = import.meta.env.VITE_S3_URL;

  // totalUsers에 따른 크기 조정 값 계산
  const sizes = useMemo(() => {
    switch (totalUsers) {
      case 1:
        return {
          iconSize: 7,      // w-7 h-7
          profileSize: 32,  //
          padding: 3,      // p-3
        };
      case 2:
        return {
          iconSize: 6,      // w-6 h-6
          profileSize: 20,  //
          padding: 2,      // p-2
        };
      default:
        return {
          iconSize: 5,      // w-5 h-5
          profileSize: 16,  //
          padding: 2,      // p-2
        };
    }
  }, [totalUsers]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;

    if (stream && stream.active) {
      videoElement.srcObject = stream;
      videoElement.muted = user.mediaState.isMuted || user.mediaState.isDeafened;
    } else {
      videoElement.srcObject = null;
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [
    user.mediaState.stream,
    user.mediaState.screenStream,
    isScreenShare,
    user.mediaState.isMuted,
    user.mediaState.isDeafened,
  ]);

  const showVideo = isScreenShare
    ? Boolean(user.mediaState.screenStream?.active)
    : user.mediaState.isCameraOn && Boolean(user.mediaState.stream?.active);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg transition-all duration-200 
        ${user.mediaState.isSpeaking && !user.mediaState.isMuted ? 'ring-2 ring-green-500' : ''}`}
    >
      {showVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      )}

      {(!showVideo && !isScreenShare) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {user.profileImage ? (
            <img
              src={BASE_URL + user.profileImage}
              alt={user.username}
              style={{
                width: `${sizes.profileSize * 4}px`,
                height: `${sizes.profileSize * 4}px`
              }}
              className="rounded-full"
            />
          ) : (
            <DefaultProfileImage
              username={user.username}
              size={sizes.profileSize * 4}
            />
          )}
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        {user.mediaState.isMuted && (
          <div className={`bg-red-500/90 rounded-full p-${sizes.padding}`}>
            <MicOff className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
          </div>
        )}
        {user.mediaState.isDeafened && (
          <div className={`bg-red-500/90 rounded-full p-${sizes.padding}`}>
            <HeadphoneOff className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
          </div>
        )}
      </div>

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