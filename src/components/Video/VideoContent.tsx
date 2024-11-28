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

  // VideoContent.tsx의 기존 users 매핑 부분을 수정
  const uniqueUsers = useMemo(() => {
    // 현재 사용자가 없으면 빈 배열 반환
    if (!currentUser) return [];

    // 기본적으로 현재 사용자를 포함
    const defaultUser = {
      ...currentUser,
      stream: null, // stream은 별도로 관리됨
    };

    const userMap = new Map();
    // 현재 사용자를 먼저 추가
    userMap.set(currentUser.user_id, defaultUser);

    // videoChatStore의 users를 순회하며 추가
    videoChatStore.users.forEach(user => {
      const key = user.user_id;
      const existingUser = userMap.get(key);

      // 기존 사용자가 있다면 스트림과 상태를 보존하면서 업데이트
      userMap.set(key, {
        ...(existingUser || {}),  // 기존 사용자 정보 보존
        ...user,  // 새로운 정보로 업데이트
        camera_on: user.camera_on || (key === currentUser.user_id && videoChatStore.isCameraOn),
        screen_sharing: user.screen_sharing || (key === currentUser.user_id && videoChatStore.isScreenSharing),
        stream: existingUser?.stream || user.stream,  // 기존 스트림 보존
      });
    });

    return Array.from(userMap.values());
  }, [currentUser, videoChatStore.users, videoChatStore.isCameraOn, videoChatStore.isScreenSharing]);

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