import React, { useEffect, useRef } from 'react';
import { CameraOff, HeadphoneOff, MicOff, MonitorUp } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { ChannelUser } from '@/stores/userChannelStore';

interface VideoUserBoxProps {
  user: ChannelUser;
  isScreenShare?: boolean;
}

export const VideoUserBox = React.memo<VideoUserBoxProps>(({ user, isScreenShare = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;

    if (stream) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
        videoElement.muted = user.mediaState.isMuted || user.mediaState.isDeafened;

        const playVideo = async () => {
          try {
            await videoElement.play();
          } catch (error) {
            console.error('Failed to play video:', error);
          }
        };

        if (videoElement.readyState >= 2) {
          playVideo();
        } else {
          videoElement.addEventListener('loadedmetadata', playVideo, { once: true });
        }
      }
    } else {
      videoElement.srcObject = null;
    }

    return () => {
      videoElement.srcObject = null;
    };
  }, [user.mediaState.stream, user.mediaState.screenStream, user.mediaState.isMuted, user.mediaState.isDeafened, isScreenShare]);

  const showVideo = isScreenShare ? user.mediaState.screenStream :
    (user.mediaState.isCameraOn && user.mediaState.stream);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.mediaState.isSpeaking && !user.mediaState.isMuted && !isScreenShare ? 'ring-2 ring-green-500 animate-pulse' : ''}
        transition-all duration-200 hover:shadow-xl`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <DefaultProfileImage username={user.username} size={80} margin="mr-1" />
        </div>
      )}

      {/* 상태 아이콘 */}
      <div className="absolute top-4 right-4 flex gap-2">
        {!isScreenShare && (
          <>
            {user.mediaState.isMuted && (
              <div className="bg-red-500/90 rounded-full p-2">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
            {user.mediaState.isDeafened && (
              <div className="bg-red-500/90 rounded-full p-2">
                <HeadphoneOff className="w-4 h-4 text-white" />
              </div>
            )}
            {!user.mediaState.isCameraOn && (
              <div className="bg-red-500/90 rounded-full p-2">
                <CameraOff className="w-4 h-4 text-white" />
              </div>
            )}
          </>
        )}
        {isScreenShare && (
          <div className="bg-green-500/90 rounded-full p-2">
            <MonitorUp className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-lg font-medium">
            {isScreenShare ? `${user.username}'s Screen` : user.username}
          </span>
        </div>
      </div>
    </div>
  );
});