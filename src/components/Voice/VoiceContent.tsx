import { useMemo, useState } from 'react';
import { UserBox } from '@/components/Voice/UserBox';
import { VoiceControls } from '@/components/Voice/VoiceControls';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { useAuthStore } from '@/stores/authStore';

export const VoiceContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { channelUsers, currentUserChannel } = useUserChannelStore();
  const currentUser = useAuthStore(state => state.user);

  const currentChannelUsers = useMemo(() => {
    if (!currentUserChannel.channelId) return [];
    return channelUsers.get(currentUserChannel.channelId) || [];
  }, [channelUsers, currentUserChannel.channelId]);

  // 화면 공유 중인 사용자 찾기
  const screenShareUser = useMemo(() => {
    return currentChannelUsers.find(user => user.mediaState.isScreenSharing);
  }, [currentChannelUsers]);

  // 일반 사용자 목록 (화면 공유 중인 사용자 제외)
  const sortedUsers = useMemo(() => {
    const nonScreenShareUsers = currentChannelUsers.filter(user => !user.mediaState.isScreenSharing);

    if (!currentUser) return nonScreenShareUsers;

    return [
      ...nonScreenShareUsers.filter(user => user.userId !== currentUser.email),
      ...nonScreenShareUsers.filter(user => user.userId === currentUser.email),
    ];
  }, [currentChannelUsers, currentUser]);

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
              key={`${screenShareUser.userId}-screen`}
              user={screenShareUser}
              isScreenShare={true}
            />
          )}

          {/* 일반 사용자 박스 */}
          {sortedUsers.map(user => (
            <UserBox
              key={user.userId}
              user={user}
              isScreenShare={false}
            />
          ))}
        </div>
      </div>

      <VoiceControls show={showControls} />
    </div>
  );
};