import React, { useEffect, useRef } from 'react';
import { CameraOff, HeadphoneOff, MicOff, MonitorUp } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage.tsx';

interface VideoUserBoxProps {
  user: {
    id: string;
    nickname: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    imageUrl?: string;
    stream?: MediaStream | null | undefined;
  };
}

export const VideoUserBox: React.FC<VideoUserBoxProps> = ({ user }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleStreamChange = async () => {
      try {
        if (user.stream && (user.isVideoOn || user.isScreenSharing)) {
          console.log('Setting up video stream for user:', {
            userId: user.id,
            stream: user.stream,
            tracks: user.stream.getTracks()
          });

          // 이전 스트림 정리
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }

          // 새 스트림 설정
          videoElement.srcObject = user.stream;

          // loadedmetadata 이벤트를 기다린 후 재생 시도
          await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve(true);
          });

          // 재생 시도 (자동 재생 정책을 고려하여 muted 상태로 재생)
          videoElement.muted = true;
          await videoElement.play();

          // 실제 mute 상태 적용
          videoElement.muted = user.isMuted;
        } else {
          videoElement.srcObject = null;
        }
      } catch (error) {
        console.error('Video playback error:', error);
      }
    };

    handleStreamChange();

    return () => {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [user.stream, user.isVideoOn, user.isScreenSharing, user.isMuted]);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.isSpeaking ? 'ring-2 ring-green-500' : ''}
        transition-all duration-200 hover:shadow-xl`}
    >
      {user.stream && (user.isVideoOn || user.isScreenSharing) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${user.isScreenSharing ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {user.imageUrl ? (
            <img
              src={import.meta.env.VITE_BE_SERVER_URL + user.imageUrl}
              alt={user.nickname}
              className="w-28 h-28 rounded-full"
            />
          ) : (
            <DefaultProfileImage username={user.nickname} size={80} margin="mr-1" />
          )}
        </div>
      )}

      {/* 상태 아이콘 */}
      <div className="absolute top-6 right-6 flex gap-3">
        {user.isMuted && (
          <div className="bg-red-500 rounded-full p-3">
            <MicOff className="w-6 h-6 text-white" />
          </div>
        )}
        {user.isDeafened && (
          <div className="bg-red-500 rounded-full p-3">
            <HeadphoneOff className="w-6 h-6 text-white" />
          </div>
        )}
        {!user.isVideoOn && (
          <div className="bg-red-500 rounded-full p-3">
            <CameraOff className="w-6 h-6 text-white" />
          </div>
        )}
        {user.isScreenSharing && (
          <div className="bg-green-500 rounded-full p-3">
            <MonitorUp className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-xl font-medium">
            {user.nickname}
            {user.isScreenSharing && " (화면 공유 중)"}
          </span>
        </div>
      </div>
    </div>
  );
};