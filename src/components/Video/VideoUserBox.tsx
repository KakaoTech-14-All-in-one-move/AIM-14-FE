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
  const currentUser = useAuthStore(state => state.user);
  const isCurrentUser = currentUser?.email === user.userId;

  // totalUsers에 따른 크기 조정 값 계산
  const sizes = useMemo(() => {
    if (isMaximized) {
      return {
        iconSize: 6,      // w-6 h-6
        profileSize: 12,  // 32px
        padding: 3,      // p-3
        textSize: 'xl',  // text-xl
      };
    }

    // isMaximized가 false일 때의 기본 크기들
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

  const logStreamInfo = (stream: MediaStream | null, context: string) => {
    console.log(`[Stream Info] ${context}:`, {
      userId: user.userId,
      isScreenShare,
      hasStream: !!stream,
      tracks: stream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        label: t.label,
      })),
    });
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    console.log('Stream details:', {
      userId: user.userId,
      hasStream: !!user.mediaState.stream,
      trackCount: user.mediaState.stream?.getTracks().length,
      videoTracks: user.mediaState.stream?.getVideoTracks().length,
      audioTracks: user.mediaState.stream?.getAudioTracks().length,
    });

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;
    logStreamInfo(stream, 'Stream Update');

    if (stream) {
      console.log('Stream tracks state:', stream.getTracks().map(track => ({
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted
      })));

      console.log(`[VideoUserBox] Attaching ${isScreenShare ? 'screen' : 'camera'} stream to video element:`, {
        userId: user.userId,
        trackCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });

      if (videoElement.srcObject !== stream) {
        console.log('Video element state:', {
          userId: user.userId,
          readyState: videoElement.readyState,
          paused: videoElement.paused,
          srcObject: !!videoElement.srcObject,
          offsetWidth: videoElement.offsetWidth,
          offsetHeight: videoElement.offsetHeight,
        });
        videoElement.srcObject = stream;
        videoElement.muted = user.mediaState.isMuted || user.mediaState.isDeafened;

        const playVideo = async () => {
          try {
            await videoElement.play();
            console.log(`[VideoUserBox] Successfully playing video for ${user.userId}`);
          } catch (error) {
            console.error(`[VideoUserBox] Failed to play video for ${user.userId}:`, error);

            if (error instanceof Error && error.name === 'NotAllowedError') {
              videoElement.muted = true;
              try {
                await videoElement.play();
                console.log(`[VideoUserBox] Retried playing muted video for ${user.userId}`);
              } catch (retryError) {
                console.error(`[VideoUserBox] Failed retry for ${user.userId}:`, retryError);
              }
            }
          }
        };

        if (videoElement.readyState >= 2) {
          playVideo();
        } else {
          videoElement.addEventListener('loadedmetadata', playVideo, { once: true });
        }
      }
    } else {
      console.log(`[VideoUserBox] No stream available for ${user.userId} (${isScreenShare ? 'screen' : 'camera'})`);
      videoElement.srcObject = null;
    }

    return () => {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [
    user.mediaState.stream,
    user.mediaState.screenStream,
    user.mediaState.isCameraOn,
    user.mediaState.isMuted,
    user.mediaState.isDeafened,
    isScreenShare,
  ]);

  const showVideo = useMemo(() => {
    console.log('ShowVideo conditions:', {
      userId: user.userId,
      isCurrentUser,
      isCameraOn: user.mediaState.isCameraOn,
      hasVideoStream: !!(user.mediaState.stream?.getVideoTracks().length > 0),
    });
    if (isScreenShare) {
      const hasScreenStream = !!user.mediaState.screenStream;
      console.log('[VideoUserBox] Screen share check:', {
        userId: user.userId,
        hasScreenStream,
      });
      return hasScreenStream;
    }

    // 스트림 상태 로깅
    console.log('[VideoUserBox] Video stream check:', {
      userId: user.userId,
      isCurrentUser,
      isCameraOn: user.mediaState.isCameraOn,
      hasStream: !!user.mediaState.stream,
      trackCount: user.mediaState.stream?.getVideoTracks().length,
    });

    const hasVideoStream = !!(
      user.mediaState.stream &&
      user.mediaState.stream.getVideoTracks().length > 0
    );

    // 현재 사용자의 경우 카메라가 켜져있으면 일단 보여주기
    if (isCurrentUser) {
      return user.mediaState.isCameraOn;
    }

    // 다른 사용자의 경우 스트림이 있어야 함
    return hasVideoStream && user.mediaState.isCameraOn;
  }, [
    isScreenShare,
    user.mediaState.stream,
    user.mediaState.screenStream,
    user.mediaState.isCameraOn,
    isCurrentUser,
  ]);

  const NoStreamDisplay = () => {
    if (isScreenShare) {
      return (
        <div className="flex flex-col items-center gap-2">
          <MonitorOff className={`w-${sizes.iconSize * 3} h-${sizes.iconSize * 3} text-gray-400`} />
          <span className="text-gray-400 text-sm">화면 공유 준비 중...</span>
        </div>
      );
    }

    // 카메라가 켜져있지만 스트림이 없는 경우
    if (user.mediaState.isCameraOn && !isCurrentUser) {
      return (
        <div className="flex flex-col items-center gap-2">
          <Video className={`w-${sizes.iconSize * 3} h-${sizes.iconSize * 3} text-gray-400`} />
          <span className="text-gray-400 text-sm">비디오 스트림 수신 중...</span>
        </div>
      );
    }

    // 카메라가 꺼져있거나 기본 상태일 경우 프로필 이미지 표시
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
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isCurrentUser || user.mediaState.isMuted || user.mediaState.isDeafened}
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <NoStreamDisplay />
        </div>
      )}

      {/* 최대화 버튼 */}
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

      {/* 상태 아이콘 */}
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

      {/* 유저 정보 */}
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