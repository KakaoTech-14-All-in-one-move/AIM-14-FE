// src/components/Voice/VoiceContent.tsx
import { useState } from 'react';
import { VoiceControls } from './VoiceControls';
import { UserBox } from './UserBox';
import { useVoiceChat } from '../../hooks/useVoiceChat';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { users } = useVoiceChat();

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 콘텐츠 영역 */}
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className={`grid gap-8 w-full max-w-[1200px] mx-auto
            ${users?.length === 1 ? 'grid-cols-1' :
            users?.length === 2 ? 'grid-cols-2' :
              users?.length === 3 || users?.length === 4 ? 'grid-cols-2' :
                'grid-cols-3'}`}
        >
          {users?.map((user) => (
            <UserBox key={user.id} user={user} />
          ))}
        </div>
      </div>

      {/* 컨트롤 영역 */}
      <VoiceControls show={showControls} />
    </div>
  );
};