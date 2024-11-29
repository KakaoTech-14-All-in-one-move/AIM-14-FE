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

  // VideoUserBox.tsx의 useEffect 부분 수정
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleStreamChange = async () => {
      try {
        if (user.stream && (user.isVideoOn || user.isScreenSharing)) {
          // 이전 스트림과 다를 때만 srcObject 업데이트
          if (videoElement.srcObject !== user.stream) {
            videoElement.srcObject = user.stream;
            videoElement.muted = true;

            // loadedmetadata 이벤트를 기다린 후 재생 시도
            await new Promise((resolve) => {
              const handleLoaded = () => {
                videoElement.removeEventListener('loadedmetadata', handleLoaded);
                resolve(null);
              };
              videoElement.addEventListener('loadedmetadata', handleLoaded);
            });

            // 재생 시도 및 재시도 로직
            const attemptPlay = async (retries: number = 3): Promise<void> => {
              try {
                await videoElement.play();
              } catch (error: unknown) {
                if (retries > 0 && error instanceof DOMException && error.name === 'AbortError') {
                  console.log(`Retrying playback, attempts left: ${retries-1}`);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  await attemptPlay(retries - 1);
                } else {
                  console.error('Failed to start video playback:', error);
                  throw error;
                }
              }
            };

            await attemptPlay();
          }
        } else {
          // 비디오가 꺼져있을 때 srcObject 제거
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
        }
      } catch (error) {
        console.error('Error in handleStreamChange:', error);
      }
    };

    handleStreamChange();

    // Cleanup
    return () => {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [user.stream, user.isVideoOn, user.isScreenSharing]);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.isSpeaking ? 'ring-2 ring-green-500' : ''}
        transition-all duration-200 hover:shadow-xl`}
    >
      {/* 비디오 또는 프로필 이미지 표시 */}
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
        {!user.isVideoOn && !user.isScreenSharing && (
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
            {user.isScreenSharing && ' (화면 공유 중)'}
          </span>
        </div>
      </div>
    </div>
  );
};