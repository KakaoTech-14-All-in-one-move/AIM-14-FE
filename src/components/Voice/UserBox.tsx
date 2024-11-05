// src/components/Voice/UserBox.tsx
import React from 'react';
import { MicOff, HeadphoneOff } from 'lucide-react';
import { User } from './types/voice';

interface UserBoxProps {
  user: User;
}

export const UserBox: React.FC<UserBoxProps> = ({ user }) => {
  return (
    <div
      className={`relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg
        ${user.isSpeaking ? 'ring-2 ring-green-500' : ''}
        transition-all duration-200 hover:shadow-xl`}
    >
      {/* 유저 이미지/아바타 영역 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.nickname}
            className="w-40 h-40 rounded-full"
          />
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-800 flex items-center justify-center">
            <span className="text-5xl text-white">{user.nickname[0].toUpperCase()}</span>
          </div>
        )}
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