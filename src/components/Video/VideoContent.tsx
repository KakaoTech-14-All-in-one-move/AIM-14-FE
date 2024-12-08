import { useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const [maximizedUserId, setMaximizedUserId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const { channelUsers, currentUserChannel } = useUserChannelStore();

  const currentChannelUsers = useMemo(() => {
    if (!currentUserChannel.channelId) return [];
    return channelUsers.get(currentUserChannel.channelId) || [];
  }, [channelUsers, currentUserChannel.channelId]);

  const displayUsers = useMemo(() => {
    const allDisplayUsers = currentChannelUsers.map(user => {
      // 기본 사용자 정보
      const baseUser = {
        ...user,
        mediaState: {
          ...user.mediaState,
          isScreenShare: false,
        },
      };

      // 화면 공유 중인 사용자가 있는지 확인
      const screenSharingUser = currentChannelUsers.find(u => u.mediaState.isScreenSharing);

      if (screenSharingUser) {
        // 화면 공유용 사용자 박스 생성
        const screenShareBox = {
          ...screenSharingUser,
          userId: `${screenSharingUser.userId}_screen`,
          mediaState: {
            ...screenSharingUser.mediaState,
            stream: screenSharingUser.mediaState.screenStream,
            isScreenShare: true,
          },
        };
        return [baseUser, screenShareBox];
      }

      return [baseUser];
    });

    // 모든 사용자 목록을 평탄화하고 중복 제거
    const flattenedUsers = allDisplayUsers.flat();
    const uniqueUsers = flattenedUsers.filter((user, index, self) =>
      index === self.findIndex(u => u.userId === user.userId),
    );

    return uniqueUsers;
  }, [currentChannelUsers]);

  const gridLayout = useMemo(() => {
    const totalUsers = displayUsers.length;
    if (totalUsers <= 1) return 'grid-cols-1';
    if (totalUsers <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  }, [displayUsers.length]);

  const USERS_PER_ROW = 6;

  const handleScroll = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setScrollPosition(Math.max(0, scrollPosition - USERS_PER_ROW));
    } else {
      setScrollPosition(Math.min(
        displayUsers.length - USERS_PER_ROW,
        scrollPosition + USERS_PER_ROW,
      ));
    }
  };

  const videoUserCount = displayUsers.length;

  if (!displayUsers.length) return null;

  // Helper function to check if a user is maximized
  const isUserMaximized = (userId: string) => {
    return userId === `${maximizedUserId}_screen`;
  };

  // 최대화된 사용자와 나머지 사용자들을 분리
  const maximizedUser = maximizedUserId ?
    displayUsers.find(user => isUserMaximized(user.userId)) : null;
  const otherUsers = displayUsers.filter(user => !isUserMaximized(user.userId));

  const showScrollButtons = otherUsers.length > USERS_PER_ROW;
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + USERS_PER_ROW < otherUsers.length;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-4"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex flex-col items-center justify-center max-h-full">
        {maximizedUser ? (
          <>
            {/* 최대화된 사용자 */}
            <div className="w-full h-[calc(100%-160px)]">
              <VideoUserBox
                user={maximizedUser}
                isScreenShare={maximizedUser.mediaState.isScreenShare}
                totalUsers={videoUserCount}
                onMaximize={() => setMaximizedUserId(null)}
                isMaximized={true}
              />
            </div>

            {/* 축소된 사용자들 */}
            <div className="relative w-full h-36">
              {showScrollButtons && canScrollLeft && (
                <button
                  onClick={() => handleScroll('left')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-gray-800/80 hover:bg-gray-700/80 rounded-full p-2 text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <div className="w-full h-full overflow-hidden px-4">
                <div
                  className="flex gap-2 h-full transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(-${scrollPosition * (100 / USERS_PER_ROW)}%)`,
                  }}
                >
                  {otherUsers.map(user => (
                    <div
                      key={user.userId}
                      className="flex-shrink-0 mt-2"
                      style={{ width: `${100 / USERS_PER_ROW}%`, maxWidth: '240px', minWidth: '160px' }}
                    >
                      <VideoUserBox
                        user={user}
                        isScreenShare={user.mediaState.isScreenShare}
                        totalUsers={6}
                        onMaximize={() => {
                          // 화면 공유일 때만 최대화 가능
                          if (user.mediaState.isScreenShare) {
                            setMaximizedUserId(user.userId.replace('_screen', ''));
                          }
                        }}
                        isMaximized={false}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {showScrollButtons && canScrollRight && (
                <button
                  onClick={() => handleScroll('right')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-gray-800/80 hover:bg-gray-700/80 rounded-full p-2 text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        ) : (
          // 기본 그리드 레이아웃
          <div className={`grid gap-4 w-full max-w-[1400px] mx-auto ${gridLayout}`}>
            {displayUsers.map(user => (
              <div key={user.userId} className="col-span-1">
                <VideoUserBox
                  user={user}
                  isScreenShare={user.mediaState.isScreenShare}
                  totalUsers={videoUserCount}
                  onMaximize={() => setMaximizedUserId(user.userId.replace('_screen', ''))}
                  isMaximized={isUserMaximized(user.userId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <VideoControls show={showControls} />
    </div>
  );
};