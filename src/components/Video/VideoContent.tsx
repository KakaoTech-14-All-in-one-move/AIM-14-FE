import { useState } from 'react';
import { VideoUserBox } from '@/components/Video/VideoUserBox';
import { VideoControls } from '@/components/Video/VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useVideoChat } from '@/hooks/useVideoChat';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser } = useCall();
  const videoChatStore = useVideoChat();

  const allUsers = currentUser
    ? [...videoChatStore.users.filter(u => u.user_id !== currentUser.user_id), currentUser]
    : videoChatStore.users;

  if (!allUsers?.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className={`grid gap-8 w-full max-w-[1200px] mx-auto ${
            allUsers.length === 1
              ? 'grid-cols-1'
              : allUsers.length === 2
                ? 'grid-cols-2'
                : allUsers.length === 3 || allUsers.length === 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
          }`}
        >
          {allUsers.map(user => (
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