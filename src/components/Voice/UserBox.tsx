import { HeadphoneOff, MicOff } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage.tsx';
import React from 'react';
import { useVoiceChat } from '@/hooks/useVoiceChat.ts';

interface UserBoxProps {
  user: {
    id: string;
    nickname: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    imageUrl?: string;
  };
}

export const UserBox: React.FC<UserBoxProps> = ({ user }) => {
  const speakingUsers = useVoiceChat(state => state.speakingUsers);
  const isSpeaking = speakingUsers.has(user.id);

  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg transition-all duration-200 
        ${isSpeaking ? 'ring-2 ring-green-500 animate-pulse' : ''}`}>
      {/* 프로필 이미지 영역 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div>
          {user.imageUrl ? (
            <img
              src={import.meta.env.VITE_BE_SERVER_URL + user.imageUrl}
              alt={user.nickname}
              className="w-28 h-28 rounded-full"
            />
          ) : (
            <DefaultProfileImage username={user.nickname} size={80} />
          )}
        </div>
      </div>

      {/* 상단의 음소거 상태 표시 */}
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
      </div>

      {/* 하단의 유저 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-xl font-medium">{user.nickname}</span>
        </div>
      </div>
    </div>
  );
};