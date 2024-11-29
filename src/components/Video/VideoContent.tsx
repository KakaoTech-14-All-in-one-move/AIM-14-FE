import { useEffect, useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useVideoChat } from '@/hooks/useVideoChat';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser, connection, connectionStatus } = useCall();
  const videoChatStore = useVideoChat();

  // 채널 연결 상태 모니터링
  useEffect(() => {
    if (connection) {
      console.log('Connection status:', connectionStatus);
      console.log('Is in channel:', connection.isInChannel());
      console.log('Current user:', currentUser);
    }
  }, [connection, connectionStatus, currentUser]);

  // VideoChat store users 상태 모니터링
  useEffect(() => {
    console.log('VideoChat store users:', videoChatStore.users);
  }, [videoChatStore.users]);

  const uniqueUsers = useMemo(() => {
    if (!currentUser) return [];

    const userMap = new Map();

    videoChatStore.users.forEach(user => {
      const isCurrentUser = user.user_id === currentUser.user_id;
      const isScreenShare = user.user_id === `${currentUser.user_id}_screen`;

      userMap.set(user.user_id, {
        ...user,
        camera_on: isCurrentUser ? videoChatStore.isCameraOn : user.camera_on,
        screen_sharing: isScreenShare ? videoChatStore.isScreenSharing : user.screen_sharing,
        muted: isCurrentUser ? videoChatStore.isMuted : user.muted,
        deafened: isCurrentUser ? videoChatStore.isDeafened : user.deafened,
        speaking: isCurrentUser ? videoChatStore.isSpeaking : user.speaking,
      });
    });

    // 현재 사용자가 맵에 없다면 추가
    if (!userMap.has(currentUser.user_id)) {
      userMap.set(currentUser.user_id, {
        ...currentUser,
        camera_on: videoChatStore.isCameraOn,
        screen_sharing: false,
        muted: videoChatStore.isMuted,
        deafened: videoChatStore.isDeafened,
        speaking: videoChatStore.isSpeaking,
        stream: null,
      });
    }

    return Array.from(userMap.values());
  }, [currentUser, videoChatStore.users, videoChatStore.isCameraOn,
    videoChatStore.isScreenSharing, videoChatStore.isMuted,
    videoChatStore.isDeafened, videoChatStore.isSpeaking]);

// uniqueUsers 체크 조건 수정
  if (!currentUser) return null; // 사용자가 없을 때만 null 반환

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className={`grid gap-8 w-full max-w-[1200px] mx-auto ${
            uniqueUsers.length === 1
              ? 'grid-cols-1'
              : uniqueUsers.length === 2
                ? 'grid-cols-2'
                : uniqueUsers.length === 3 || uniqueUsers.length === 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
          }`}
        >
          {uniqueUsers.map(user => (
            <VideoUserBox
              key={user.user_id}
              user={{
                id: user.user_id,
                nickname: user.username,
                isSpeaking: user.speaking,
                isMuted: user.muted,
                isDeafened: user.deafened,
                isVideoOn: user.camera_on,
                isScreenSharing: user.screen_sharing,
                imageUrl: user.profile_image,
                stream: user.stream,
              }}
            />
          ))}
        </div>
      </div>
      <VideoControls show={showControls} />
    </div>
  );
};