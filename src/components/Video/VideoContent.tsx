import { useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useUserChannelStore } from '@/stores/userChannelStore';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { channelUsers, currentUserChannel } = useUserChannelStore();

  const currentChannelUsers = useMemo(() => {
    if (!currentUserChannel.channelId) return [];
    return channelUsers.get(currentUserChannel.channelId) || [];
  }, [channelUsers, currentUserChannel.channelId]);

  // 화면 공유 엔트리 생성을 포함한 표시할 사용자 목록
  const displayUsers = useMemo(() => {
    const regularUsers = currentChannelUsers;

    // 화면 공유 중인 사용자들의 추가 엔트리 생성
    const screenShareEntries = regularUsers
      .filter(user => user.mediaState.isScreenSharing)
      .map(user => ({
        ...user,
        userId: `${user.userId}_screen`,
        username: user.username,
        // screenStream을 주 스트림으로 사용
        mediaState: {
          ...user.mediaState,
          stream: user.mediaState.screenStream,
          isScreenShare: true,
        },
      }));

    return [...regularUsers, ...screenShareEntries];
  }, [currentChannelUsers]);

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
              className={user.mediaState.isScreenSharing ? 'col-span-2' : ''}
            >
              <VideoUserBox
                user={user}
                isScreenShare={user.mediaState.isScreenSharing}
              />
            </div>
          ))}
        </div>
      </div>

      <VideoControls show={showControls} />
    </div>
  );
};