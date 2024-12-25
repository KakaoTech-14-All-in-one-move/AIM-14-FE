import React, { useEffect, useMemo, useRef } from 'react';
import { CameraOff, HeadphoneOff, Maximize2, MicOff, Minimize2, MonitorOff, MonitorUp, Video } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { ChannelUser } from '@/stores/userChannelStore';
import { useAuthStore } from '@/stores/authStore.ts';

interface VideoUserBoxProps {
  user: ChannelUser;
  isScreenShare?: boolean;
  totalUsers: number;
  onMaximize?: () => void;
  isMaximized?: boolean;
}

export const VideoUserBox = React.memo<VideoUserBoxProps>(({
                                                             user,
                                                             isScreenShare = false,
                                                             totalUsers,
                                                             onMaximize,
                                                             isMaximized = false,
                                                           }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const BASE_URL = import.meta.env.VITE_S3_URL;
  const isCurrentUser = useAuthStore(state => state.user?.user_id.toString()) === user.userId;

  const sizes = useMemo(() => {
    if (isMaximized) {
      return {
        iconSize: 6,      // w-6 h-6
        profileSize: 12,  // 32px
        padding: 3,      // p-3
        textSize: 'xl',  // text-xl
      };
    }

    switch (totalUsers) {
      case 1:
        return {
          iconSize: 6,      // w-6 h-6
          profileSize: 32,  // 32px
          padding: 3,      // p-3
          textSize: 'xl',  // text-xl
        };
      case 2:
        return {
          iconSize: 5,      // w-5 h-5
          profileSize: 20,  // 24px
          padding: 2,      // p-2
          textSize: 'lg',  // text-lg
        };
      default:
        return {
          iconSize: 4,      // w-4 h-4
          profileSize: 16,  // 16px
          padding: 2,      // p-2
          textSize: 'base', // text-base
        };
    }
  }, [totalUsers, isMaximized]);


  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    console.log('Video element setup:', {
      userId: user.userId,
      isCurrentUser,
      mediaState: {
        isCameraOn: user.mediaState.isCameraOn,
        isScreenShare,
        streamInfo: (() => {
          const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;
          if (!stream) return null;

          return {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(track => ({
              kind: track.kind,
              enabled: track.enabled,
              muted: track.muted,
              id: track.id,
              label: track.label,
              readyState: track.readyState
            }))
          };
        })()
      }
    });

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;

    if (stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }, [user.mediaState.stream, user.mediaState.screenStream, isScreenShare, isCurrentUser]);

  const showVideo = useMemo(() => {
    // 화면 공유인 경우
    if (isScreenShare) {
      return !!user.mediaState.screenStream;
    }

    // 현재 사용자인 경우 카메라 켜짐 여부만 확인
    if (isCurrentUser) {
      return user.mediaState.isCameraOn;
    }

    // 다른 사용자의 경우 스트림과 트랙 확인
    const hasVideoTracks = user.mediaState.stream?.getVideoTracks().length > 0;
    return user.mediaState.isCameraOn && hasVideoTracks;
  }, [
    isScreenShare,
    user.mediaState.stream,
    user.mediaState.screenStream,
    user.mediaState.isCameraOn,
    isCurrentUser,
  ]);

  const NoStreamDisplay = () => {
    // 현재 사용자이고 카메라가 켜져 있으면 NoStreamDisplay를 보여주지 않음
    if (isCurrentUser && user.mediaState.isCameraOn) {
      return null;
    }

    if (isScreenShare) {
      return (
        <div className="flex flex-col items-center gap-2">
          <MonitorOff className={`w-${sizes.iconSize * 3} h-${sizes.iconSize * 3} text-gray-400`} />
          <span className="text-gray-400 text-sm">화면 공유 준비 중...</span>
        </div>
      );
    }

    // 다른 사용자의 카메라가 켜져있는데 비디오가 보이지 않는 경우에만 로딩 표시
    if (user.mediaState.isCameraOn && !isCurrentUser && !user.mediaState.stream?.getVideoTracks().length) {
      return (
        <div className="flex flex-col items-center gap-2">
          <Video className={`w-${sizes.iconSize * 3} h-${sizes.iconSize * 3} text-gray-400`} />
          <span className="text-gray-400 text-sm">비디오 스트림 수신 중...</span>
        </div>
      );
    }

    return user.profileImage ? (
      <img
        src={BASE_URL + user.profileImage}
        alt={user.username}
        style={{
          width: `${sizes.profileSize * 4}px`,
          height: `${sizes.profileSize * 4}px`,
        }}
        className="rounded-full"
      />
    ) : (
      <DefaultProfileImage
        username={user.username}
        size={sizes.profileSize * 4}
      />
    );
  };

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.mediaState.isSpeaking && !user.mediaState.isMuted && !isScreenShare ? 'ring-2 ring-green-500' : ''}
        transition-all duration-200 hover:shadow-xl
        ${isMaximized ? 'h-full' : ''}`}
    >
      {showVideo || (isCurrentUser && user.mediaState.isCameraOn) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isCurrentUser}
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <NoStreamDisplay />
        </div>
      )}

      {isScreenShare && onMaximize && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onMaximize();
          }}
          className={`absolute top-4 left-4 bg-gray-800/90 hover:bg-gray-700/90 rounded-full p-${sizes.padding} cursor-pointer transition-colors duration-200`}
        >
          {isMaximized ? (
            <Minimize2 className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
          ) : (
            <Maximize2 className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
          )}
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        {!isScreenShare && (
          <>
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
            <div
              className={`rounded-full p-${sizes.padding} ${user.mediaState.isCameraOn ? (showVideo ? 'bg-green-500/90' : 'bg-yellow-500/90') : 'bg-red-500/90'}`}>
              {user.mediaState.isCameraOn ? (
                <Video className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
              ) : (
                <CameraOff className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
              )}
            </div>
          </>
        )}
        {isScreenShare && (
          <div className={`${showVideo ? 'bg-green-500/90' : 'bg-yellow-500/90'} rounded-full p-${sizes.padding}`}>
            {showVideo ? (
              <MonitorUp className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
            ) : (
              <MonitorOff className={`w-${sizes.iconSize} h-${sizes.iconSize} text-white`} />
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className={`text-white text-${sizes.textSize} font-medium`}>
            {isScreenShare ? `${user.username}'s Screen` : user.username}
          </span>
        </div>
      </div>
    </div>
  );
});