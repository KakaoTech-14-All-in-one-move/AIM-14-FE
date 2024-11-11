// VideoContent.tsx
import { VideoUserBox } from './VideoUserBox';
import { VideoControls } from './VideoControls';
import { useState, useEffect } from 'react';  // useEffect 추가
import { useParams } from 'react-router-dom'; // useParams 추가
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser, connection } = useCall();  // connection 추가
  const voiceChatStore = useVoiceChat();
  const { channelId } = useParams();

  useEffect(() => {
    if (connection && channelId) {
      connection.joinChannel(channelId, 'VIDEO');
    }

    return () => {
      if (connection) {
        connection.leaveChannel();
      }
    };
  }, [connection, channelId]);

  // 화면 공유 중인 사용자를 별도의 유저로 추가
  const allUsers = currentUser
    ? [...voiceChatStore.users.filter(u => u.user_id !== currentUser.user_id), currentUser]
    : voiceChatStore.users;

  const displayUsers = [...allUsers];

  // 화면 공유 중인 사용자를 별도의 유저로 추가
  allUsers.forEach(user => {
    if (user.screen_sharing) {
      displayUsers.push({
        ...user,
        user_id: `screen-${user.user_id}`,
        username: `${user.username}의 화면`,
        isScreenShareUser: true
      });
    }
  });

  if (!displayUsers?.length) return null;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center bg-black text-white p-8"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div className={`grid gap-8 w-full max-w-[1200px] mx-auto
          ${displayUsers.length === 1 ? 'grid-cols-1' :
          displayUsers.length === 2 ? 'grid-cols-2' :
            displayUsers.length === 3 || displayUsers.length === 4 ? 'grid-cols-2' :
              'grid-cols-3'}`}
        >
          {displayUsers.map((user) => (
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
                imageUrl: user.profile_image
              }}
            />
          ))}
        </div>
      </div>
      <VideoControls show={showControls} />
    </div>
  );
};