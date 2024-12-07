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

  const displayUsers = useMemo(() => {
    // 모든 사용자 목록을 매핑
    const allDisplayUsers = currentChannelUsers.map(user => {
      // 기본 사용자 박스용 항목
      const baseUser = {
        ...user,
        mediaState: {
          ...user.mediaState,
          isScreenShare: false,
        },
      };

      // 화면 공유 중인 경우에만 추가 항목 생성
      if (user.mediaState.isScreenSharing && user.mediaState.screenStream) {
        const screenShareUser = {
          ...user,
          userId: `${user.userId}_screen`,
          mediaState: {
            ...user.mediaState,
            stream: user.mediaState.screenStream,
            isScreenShare: true,
          },
        };
        return [baseUser, screenShareUser];
      }

      return [baseUser];
    });

    // 평탄화하여 최종 배열 생성
    return allDisplayUsers.flat();
  }, [currentChannelUsers]);

  const gridLayout = useMemo(() => {
    const totalUsers = displayUsers.length;

    if (totalUsers <= 1) return 'grid-cols-1';
    if (totalUsers <= 4) return 'grid-cols-2';
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
            <div key={user.userId} className="col-span-1">
              <VideoUserBox
                user={user}
                isScreenShare={user.mediaState.isScreenShare}
              />
            </div>
          ))}
        </div>
      </div>

      <VideoControls show={showControls} />
    </div>
  );
};