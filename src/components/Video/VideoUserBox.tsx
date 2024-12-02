import React, { useEffect, useRef } from 'react';
import { CameraOff, HeadphoneOff, MicOff, MonitorUp } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { useVideoChat } from '@/hooks/useVideoChat';

interface VideoUserBoxProps {
  userId: string;
  username: string;
  profileImage?: string;
  isScreenShare?: boolean;
}

export const VideoUserBox: React.FC<VideoUserBoxProps> = ({
                                                            userId,
                                                            username,
                                                            profileImage,
                                                            isScreenShare = false
                                                          }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const baseUserId = isScreenShare ? userId.replace('_screen', '') : userId;

  const userState = useVideoChat(state => state.userStates.get(baseUserId));
  const speakingUsers = useVideoChat(state => state.speakingUsers);
  const isSpeaking = speakingUsers.has(baseUserId);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleStreamChange = async () => {
      try {
        let streamToUse = null;

        if (isScreenShare) {
          // 화면 공유 박스인 경우 화면 공유 스트림 사용
          if (userState?.screenSharing && userState.stream) {
            streamToUse = userState.stream;
          }
        } else {
          // 일반 사용자 박스인 경우 카메라 스트림 사용
          if (userState?.stream && userState.cameraOn) {
            streamToUse = userState.stream;
          }
        }

        if (streamToUse) {
          if (videoElement.srcObject !== streamToUse) {
            videoElement.srcObject = streamToUse;
            videoElement.muted = true;

            await new Promise((resolve) => {
              const handleLoaded = () => {
                videoElement.removeEventListener('loadedmetadata', handleLoaded);
                resolve(null);
              };
              videoElement.addEventListener('loadedmetadata', handleLoaded);
            });

            const attemptPlay = async (retries = 3): Promise<void> => {
              try {
                await videoElement.play();
              } catch (error) {
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
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
        }
      } catch (error) {
        console.error('Error in handleStreamChange:', error);
      }
    };

    handleStreamChange();

    return () => {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [userState?.stream, userState?.cameraOn, userState?.screenSharing, isScreenShare]);

  if (!userState) return null;

  const showVideo = isScreenShare
    ? userState.screenSharing && userState.stream
    : userState.cameraOn && userState.stream;

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${isSpeaking && !userState.muted && !isScreenShare ? 'ring-2 ring-green-500 animate-pulse' : ''}
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
          {!isScreenShare && (
            profileImage ? (
              <img
                src={import.meta.env.VITE_BE_SERVER_URL + profileImage}
                alt={username}
                className="w-28 h-28 rounded-full"
              />
            ) : (
              <DefaultProfileImage username={username} size={80} margin="mr-1" />
            )
          )}
        </div>
      )}

      {/* 상태 아이콘 (화면 공유 박스에는 표시하지 않음) */}
      {!isScreenShare && (
        <div className="absolute top-6 right-6 flex gap-3">
          {userState.muted && (
            <div className="bg-red-500 rounded-full p-3">
              <MicOff className="w-6 h-6 text-white" />
            </div>
          )}
          {userState.deafened && (
            <div className="bg-red-500 rounded-full p-3">
              <HeadphoneOff className="w-6 h-6 text-white" />
            </div>
          )}
          {!userState.cameraOn && !isScreenShare && (
            <div className="bg-red-500 rounded-full p-3">
              <CameraOff className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      )}

      {/* 화면 공유 표시 */}
      {isScreenShare && (
        <div className="absolute top-6 right-6">
          <div className="bg-green-500 rounded-full p-3">
            <MonitorUp className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-xl font-medium">
            {username}
          </span>
        </div>
      </div>
    </div>
  );
};