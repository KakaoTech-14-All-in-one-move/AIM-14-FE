import { useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useVideoChat } from '@/hooks/useVideoChat';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser } = useCall();
  const users = useVideoChat(state => state.users);
  const userStates = useVideoChat(state => state.userStates);

  const displayUsers = useMemo(() => {
    if (!currentUser) return users;

    // 기본 사용자 목록
    let allUsers = users.slice();

    // 현재 사용자가 목록에 없으면 추가
    const currentUserExists = users.some(u => u.user_id === currentUser.user_id);
    if (!currentUserExists) {
      allUsers.push({
        ...currentUser,
        stream: null,
        connectionStatus: 'connected',
        camera_on: false,
        screen_sharing: false
      });
    }

    // 화면 공유 중인 사용자들에 대해 화면 공유 박스 추가
    const screenShareUsers = allUsers.filter(user => {
      const userState = userStates.get(user.user_id);
      return userState?.screenSharing;
    });

    // 화면 공유 사용자에 대한 별도의 박스 추가
    screenShareUsers.forEach(user => {
      const userState = userStates.get(user.user_id);
      if (userState?.screenSharing && userState.stream) {
        allUsers.push({
          ...user,
          user_id: `${user.user_id}_screen`,
          username: `${user.username} (화면 공유)`,
          camera_on: false,
          screen_sharing: true,
        });
      }
    });

    return allUsers;
  }, [users, currentUser, userStates]);

  if (!displayUsers?.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className={`grid gap-8 w-full max-w-[1200px] mx-auto ${
            displayUsers.length === 1
              ? 'grid-cols-1'
              : displayUsers.length === 2
                ? 'grid-cols-2'
                : displayUsers.length === 3 || displayUsers.length === 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
          }`}
        >
          {displayUsers
            .filter(user => user != null)
            .map(user => (
              <VideoUserBox
                key={user.user_id}
                userId={user.user_id}
                username={user.username}
                profileImage={user.profile_image}
                isScreenShare={user.user_id.endsWith('_screen')}
              />
            ))}
        </div>
      </div>
      <VideoControls show={showControls} />
    </div>
  );
};