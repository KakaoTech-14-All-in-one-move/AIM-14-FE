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
    const users = channelUsers.get(currentUserChannel.channelId) || [];
    // 현재 사용자는 항상 표시하고, 다른 사용자는 스트림이 있을 때만
    return users.filter(user => {
      if (user.userId === currentUser?.email) return true;
      return user.mediaState.stream?.active || user.mediaState.screenStream?.active;
    });
  }, [channelUsers, currentUserChannel.channelId, currentUser]);

  const { screenShareUser, sortedUsers } = useMemo(() => {
    const screenShareUser = currentChannelUsers.find(
      user => user.mediaState.isScreenSharing && user.mediaState.screenStream?.active,
    );

    const nonScreenShareUsers = currentChannelUsers.filter(user =>
      !user.mediaState.isScreenSharing || !user.mediaState.screenStream?.active,
    );

    const sortedUsers = currentUser ? [
      ...nonScreenShareUsers.filter(user => user.userId !== currentUser.email),
      ...nonScreenShareUsers.filter(user => user.userId === currentUser.email),
    ] : nonScreenShareUsers;

    return { screenShareUser, sortedUsers };
  }, [currentChannelUsers, currentUser]);

  const gridLayout = useMemo(() => {
    const totalBoxes = sortedUsers.length + (screenShareUser ? 1 : 0);
    if (totalBoxes <= 1) return 'grid-cols-1';
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
          {screenShareUser && (
            <UserBox
              key={`${screenShareUser.userId}-screen`}
              user={screenShareUser}
              isScreenShare={true}
            />
          )}

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