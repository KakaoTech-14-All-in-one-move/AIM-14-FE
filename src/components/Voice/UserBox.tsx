import { HeadphoneOff, MicOff } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage.tsx';
import React, { useRef, useEffect } from 'react';
import { useVoiceChat } from '@/hooks/useVoiceChat.ts';
import { CallUserData } from '@/services/call/types';
import { ConnectionStatus } from '@/components/Voice/types/voice.ts';

interface EnhancedCallUserData extends CallUserData {
  stream: MediaStream | null;
  connectionStatus: ConnectionStatus;
}

interface UserBoxProps {
  user: EnhancedCallUserData;
}

export const UserBox: React.FC<UserBoxProps> = ({ user }) => {
  const userState = useVoiceChat(state => state.userStates.get(user.user_id));
  const isSpeaking = useVoiceChat(state => state.speakingUsers.has(user.user_id));
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && userState?.stream) {
      videoRef.current.srcObject = userState.stream;
    }
  }, [userState?.stream]);

  if (!userState) return null;

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg transition-all duration-200 
        ${isSpeaking ? 'ring-2 ring-green-500 animate-pulse' : ''}`}
    >
      {/* 비디오 스트림 */}
      {userState.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={userState.muted || userState.deafened}
          className="w-full h-full object-cover"
        />
      )}

      {/* 프로필 이미지 영역 */}
      {!userState.stream && (
        <div className="absolute inset-0 flex items-center justify-center">
          {user.profile_image ? (
            <img
              src={import.meta.env.VITE_BE_SERVER_URL + user.profile_image}
              alt={user.username}
              className="w-28 h-28 rounded-full"
            />
          ) : (
            <DefaultProfileImage username={user.username} size={80} />
          )}
        </div>
      )}

      {/* 상태 아이콘 */}
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
      </div>

      {/* 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-xl font-medium">{user.username}</span>
          {user.connectionStatus !== 'connected' && (
            <span className="text-yellow-500 text-sm">
              {user.connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};