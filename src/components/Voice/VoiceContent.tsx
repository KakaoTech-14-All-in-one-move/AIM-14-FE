import { useMemo, useState } from 'react';
import { UserBox } from '@/components/Voice/UserBox';
import { VoiceControls } from '@/components/Voice/VoiceControls';
import { useMediaChat } from '@/hooks/useMediaChat';
import { useMediaStore } from '@/stores/mediaStore';
import { useUserStore } from '@/stores/userStore';
import { convertCallUserToMediaUser } from '@/types/media';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const users = useUserStore(state => state.users);
  const currentUser = useUserStore(state => state.currentUser);
  const mediaStore = useMediaStore();
  const mediaChat = useMediaChat();

  // 화면 공유 중인 사용자 찾기
  const screenShareUser = useMemo(() => {
    return users.find(user => {
      const state = mediaChat.userStates.get(user.user_id);
      return state && state.screenSharing;
    });
  }, [users, mediaChat.userStates]);

  // 일반 사용자 목록 (화면 공유 중인 사용자 제외)
  const sortedUsers = useMemo(() => {
    const nonScreenShareUsers = users.filter(user => {
      const state = mediaChat.userStates.get(user.user_id);
      return !state?.screenSharing;
    });

    if (!currentUser) return nonScreenShareUsers;

    return [
      ...nonScreenShareUsers.filter(u => u.user_id !== currentUser.user_id),
      ...nonScreenShareUsers.filter(u => u.user_id === currentUser.user_id),
    ];
  }, [users, currentUser, mediaChat.userStates]);

  // 그리드 레이아웃 계산
  const gridLayout = useMemo(() => {
    const totalBoxes = sortedUsers.length + (screenShareUser ? 1 : 0);
    if (totalBoxes <= 1) return 'grid-cols-1';
    if (totalBoxes === 2) return 'grid-cols-2';
    if (totalBoxes <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  }, [sortedUsers.length, screenShareUser]);

  if (!sortedUsers.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div className={`grid gap-4 w-full max-w-[1400px] mx-auto ${gridLayout}`}>
          {/* 화면 공유 박스 */}
          {screenShareUser && (
            <UserBox
              key={`${screenShareUser.user_id}-screen`}
              user={{
                ...convertCallUserToMediaUser(screenShareUser),
                screenSharing: true,
              }}
              isScreenShare={true}
            />
          )}

          {/* 일반 사용자 박스 */}
          {sortedUsers.map(user => (
            <UserBox
              key={user.user_id}
              user={convertCallUserToMediaUser(user)}
              isScreenShare={false}
            />
          ))}
        </div>
      </div>

      <VoiceControls
        show={showControls}
        isVideo={mediaStore.channelType === 'VIDEO'}
      />
    </div>
  );
};