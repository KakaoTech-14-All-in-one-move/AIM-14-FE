import { UserBox } from '@/components/Voice/UserBox.tsx';
import { VoiceControls } from '@/components/Voice/VoiceControls.tsx';
import { useState } from 'react';
import { useCall } from '@/services/call/CallProvider.tsx';
import { useVoiceChat } from '@/hooks/useVoiceChat';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser } = useCall();
  const voiceChatStore = useVoiceChat();  // VoiceChat store 사용

  // VoiceChat store의 users 사용
  const allUsers = currentUser
    ? [...voiceChatStore.users.filter(u => u.user_id !== currentUser.user_id), currentUser]
    : voiceChatStore.users;

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
                isDeafened: user.deafened,
                imageUrl: user.profile_image
              }}
            />
          ))}
        </div>
      </div>
      <VoiceControls show={showControls} />
    </div>
  );
};