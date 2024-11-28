import { useEffect, useMemo, useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser, connection, connectionStatus } = useCall();
  const voiceChatStore = useVoiceChat();

  // 채널 연결 상태 모니터링
  useEffect(() => {
    if (connection) {
      console.log('Connection status:', connectionStatus);
      console.log('Is in channel:', connection.isInChannel());
      console.log('Current user:', currentUser);
    }
  }, [connection, connectionStatus, currentUser]);

  // VoiceChat store users 상태 모니터링
  useEffect(() => {
    console.log('VoiceChat store users:', voiceChatStore.users);
  }, [voiceChatStore.users]);

  const uniqueUsers = useMemo(() => {
    const userMap = new Map();
    voiceChatStore.users.forEach(user => {
      const key = `${user.channel_type}-${user.user_id}-${user.channel_id}`;
      if (!userMap.has(key)) {
        userMap.set(key, user);
      }
    });
    return Array.from(userMap.values());
  }, [voiceChatStore.users]);

  if (!uniqueUsers?.length) return null;

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
          {uniqueUsers.map(user => {
            const userKey = `${user.channel_type}-${user.user_id}-${user.channel_id}-${user.screen_sharing ? 'screen' : 'cam'}`;

            return (
              <VideoUserBox
                key={userKey}
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
            );
          })}
        </div>
      </div>
      <VideoControls show={showControls} />
    </div>
  );
};