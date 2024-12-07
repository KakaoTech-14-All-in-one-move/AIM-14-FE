import React, { useEffect, useMemo, useRef } from 'react';
import { CameraOff, HeadphoneOff, MicOff, MonitorUp } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { ChannelUser } from '@/stores/userChannelStore';

interface VideoUserBoxProps {
  user: ChannelUser;
  isScreenShare?: boolean;
}

export const VideoUserBox = React.memo<VideoUserBoxProps>(({ user, isScreenShare = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL;

  // 스트림 상태 디버깅을 위한 상세 로깅
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
        label: t.label
      }))
    });
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const stream = isScreenShare ? user.mediaState.screenStream : user.mediaState.stream;

    // 스트림 상태 로깅
    logStreamInfo(stream, 'Stream Update');

    if (stream) {
      console.log(`[VideoUserBox] Attaching ${isScreenShare ? 'screen' : 'camera'} stream to video element:`, {
        userId: user.userId,
        trackCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // 스트림 연결
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
        videoElement.muted = user.mediaState.isMuted || user.mediaState.isDeafened;

        // 비디오 재생 시도
        const playVideo = async () => {
          try {
            await videoElement.play();
            console.log(`[VideoUserBox] Successfully playing video for ${user.userId}`);
          } catch (error) {
            console.error(`[VideoUserBox] Failed to play video for ${user.userId}:`, error);

            // 자동 재생 정책 문제 해결을 위한 재시도
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
    isScreenShare
  ]);

  // 비디오 표시 조건 로직 개선
  const showVideo = useMemo(() => {
    if (isScreenShare) {
      const hasScreenStream = !!user.mediaState.screenStream;
      console.log(`[VideoUserBox] Screen share display check for ${user.userId}:`, {
        hasScreenStream,
        tracks: user.mediaState.screenStream?.getTracks().length
      });
      return hasScreenStream;
    }

    const hasVideoStream = !!(
      user.mediaState.stream &&
      user.mediaState.stream.getVideoTracks().length > 0 &&
      user.mediaState.isCameraOn
    );

    console.log(`[VideoUserBox] Video display check for ${user.userId}:`, {
      hasStream: !!user.mediaState.stream,
      hasVideoTracks: user.mediaState.stream?.getVideoTracks().length! > 0,
      isCameraOn: user.mediaState.isCameraOn
    });

    return hasVideoStream;
  }, [isScreenShare, user.mediaState.stream, user.mediaState.screenStream, user.mediaState.isCameraOn]);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.mediaState.isSpeaking && !user.mediaState.isMuted && !isScreenShare ? 'ring-2 ring-green-500' : ''}
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