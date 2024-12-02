import { UserBox } from '@/components/Voice/UserBox.tsx';
import { VoiceControls } from '@/components/Voice/VoiceControls.tsx';
import { useMemo, useState } from 'react';
import { useCall } from '@/services/call/CallProvider.tsx';
import { useVoiceChat } from '@/hooks/useVoiceChat';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser } = useCall();
  const users = useVoiceChat(state => state.users);

  // users 배열에서 중복 제거 및 정렬
  const sortedUsers = useMemo(() => {
    const uniqueUsers = Array.from(new Map(users.map(user => [user.user_id, user])).values());
    if (!currentUser) return uniqueUsers;

    // 현재 사용자를 마지막으로 정렬
    return [
      ...uniqueUsers.filter(u => u.user_id !== currentUser.user_id),
      ...uniqueUsers.filter(u => u.user_id === currentUser.user_id)
    ];
  }, [users, currentUser]);

  if (!sortedUsers.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className={`grid gap-8 w-full max-w-[1200px] mx-auto ${
            sortedUsers.length === 1 ? 'grid-cols-1' :
              sortedUsers.length === 2 ? 'grid-cols-2' :
                sortedUsers.length <= 4 ? 'grid-cols-2' :
                  'grid-cols-3'
          }`}
        >
          {sortedUsers.map(user => (
            <UserBox key={user.user_id} user={user} />
          ))}
        </div>
      </div>
      <VoiceControls show={showControls} />
    </div>
  );
};