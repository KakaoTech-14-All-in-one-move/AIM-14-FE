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
        // 비디오 스트림이 있고, 카메라나 화면 공유가 켜져있을 때
        if (user.stream && (user.isVideoOn || user.isScreenSharing)) {
          console.log('Setting up video stream for user:', user.id, {
            stream: user.stream,
            isVideoOn: user.isVideoOn,
            isScreenSharing: user.isScreenSharing
          });

          // 이전 스트림 정리
          if (videoElement.srcObject) {
            const oldStream = videoElement.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
          }

          // 새 스트림 설정 전에 약간의 지연을 줍니다
          await new Promise(resolve => setTimeout(resolve, 100));

          // 새 스트림 설정
          videoElement.srcObject = user.stream;
          videoElement.muted = true;

          try {
            // play 시도 전에 readyState 확인
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA 이상
              await videoElement.play();
              console.log('Video playback started successfully for user:', user.id);
            } else {
              // 미디어가 로드될 때까지 대기
              await new Promise((resolve) => {
                videoElement.addEventListener('loadeddata', resolve, { once: true });
              });
              await videoElement.play();
            }
          } catch (playError) {
            console.error('Failed to start video playback:', playError);
            // 실패 시 재시도
            videoElement.muted = true;
            await videoElement.play();
          }
        } else {
          if (videoElement.srcObject) {
            const oldStream = videoElement.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
          }
        }
      } catch (error) {
        console.error('Video stream setup error:', error);
      }
    };
    handleStreamChange();

    // Cleanup function
    return () => {
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
    };
  }, [user.stream, user.isVideoOn, user.isScreenSharing, user.id]);

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