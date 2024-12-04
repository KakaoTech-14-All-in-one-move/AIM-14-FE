import { useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useMediaChat } from '@/hooks/useMediaChat';
import { useUserStore } from '@/stores/userStore';
import { MediaUser, convertCallUserToMediaUser } from '@/types/media';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser } = useCall();
  const users = useUserStore(state => state.users);
  const mediaChat = useMediaChat();

  const displayUsers = useMemo<MediaUser[]>(() => {
    // 기본 사용자 목록 (현재 사용자가 없으면 추가)
    const baseUsers = currentUser
      ? (users.some(u => u.user_id === currentUser.user_id)
        ? users
        : [...users, currentUser])
      : users;

    // MediaUser 타입으로 변환
    const mediaUsers = baseUsers.map(convertCallUserToMediaUser);

    // 화면 공유 중인 사용자들의 추가 엔트리 생성
    const screenShareEntries = mediaUsers
      .filter(user => mediaChat.userStates.get(user.userId)?.screenSharing)
      .map(user => ({
        ...user,
        userId: `${user.userId}_screen`,
        username: `${user.username} (Screen)`,
        stream: mediaChat.userStates.get(user.userId)?.screenStream ?? null
      }));

    return [...mediaUsers, ...screenShareEntries];
  }, [users, currentUser, mediaChat.userStates]);

  const gridLayout = useMemo(() => {
    const totalBoxes = displayUsers.length;
    if (totalBoxes <= 1) return 'grid-cols-1';
    if (totalBoxes === 2) return 'grid-cols-2';
    if (totalBoxes <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  }, [displayUsers.length]);

  if (!displayUsers.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div className={`grid gap-4 w-full max-w-[1400px] mx-auto ${gridLayout}`}>
          {displayUsers.map(user => (
            <div
              key={user.userId}
              className={user.userId.includes('_screen') ? 'col-span-2' : ''}
            >
              <VideoUserBox
                user={user}
                isScreenShare={user.userId.includes('_screen')}
              />
            </div>
          ))}
        </div>
      </div>

      <VideoControls show={showControls} />
    </div>
  );
};