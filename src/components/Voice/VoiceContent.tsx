// VoiceContent.tsx 수정
import { UserBox } from './UserBox.tsx';
import { VoiceControls } from './VoiceControls.tsx';
import { useState } from 'react';
import { useCall } from '../../services/call/CallProvider.tsx';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { users, currentUser } = useCall();

  // null 값을 필터링하고 타입 보장
  const allUsers = currentUser
    ? [...users.filter(u => u.user_id !== currentUser.user_id), currentUser].filter((user): user is CallUserData => user !== null)
    : users;

  if (!allUsers?.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div className={`grid gap-8 w-full max-w-[1200px] mx-auto
          ${allUsers.length === 1 ? 'grid-cols-1' :
          allUsers.length === 2 ? 'grid-cols-2' :
            allUsers.length === 3 || allUsers.length === 4 ? 'grid-cols-2' :
              'grid-cols-3'}`}
        >
          {allUsers.map((user) => (
            <UserBox
              key={user.user_id}
              user={{
                id: user.user_id,
                nickname: user.username,
                isSpeaking: user.speaking,
                isMuted: user.muted,
                isDeafened: user.deafened
              }}
            />
          ))}
        </div>
      </div>
      <VoiceControls show={showControls} />
    </div>
  );
};