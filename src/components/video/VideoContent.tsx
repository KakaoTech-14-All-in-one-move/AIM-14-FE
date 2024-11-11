import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { VideoUserBox } from './VideoUserBox';
import { VideoControls } from './VideoControls';
import { useCall } from '@/services/call/CallProvider';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface DisplayUser {
  id: string;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  imageUrl?: string;
  stream?: MediaStream;
}

export const VideoContent = () => {
  const [showControls, setShowControls] = useState(false);
  const { currentUser, connection, connectionStatus } = useCall();
  const voiceChatStore = useVoiceChat();
  const { channelId } = useParams();

  // 채널 접속 처리
  useEffect(() => {
    const joinChannel = async () => {
      if (connection && channelId) {
        try {
          console.log('Joining channel:', channelId);
          await connection.joinChannel(channelId, 'VIDEO');
          console.log('Successfully joined channel');
        } catch (error) {
          console.error('Failed to join channel:', error);
        }
      }
    };

    joinChannel();

    return () => {
      if (connection) {
        connection.leaveChannel();
      }
    };
  }, [connection, channelId]);

  // 채널 연결 상태 모니터링
  useEffect(() => {
    if (connection) {
      console.log('Connection status:', connectionStatus);
      console.log('Is in channel:', connection.isInChannel());
      console.log('Current user:', currentUser);
    }
  }, [connection, connectionStatus, currentUser]);

  // DisplayUser 인터페이스에 맞게 사용자 데이터 변환
  const displayUsers: DisplayUser[] = voiceChatStore.users.map(user => {
    console.log('매핑 전 원본 사용자 데이터:', user); // 디버깅용

    const displayUser: DisplayUser = {
      id: user.user_id,
      nickname: user.username,
      isSpeaking: user.speaking,
      isMuted: user.muted,
      isDeafened: user.deafened,
      isVideoOn: user.camera_on,
      isScreenSharing: user.screen_sharing,
      imageUrl: user.profile_image,
      stream: user.stream  // MediaStream 객체 매핑
    };

    console.log('매핑 후 디스플레이 사용자 데이터:', displayUser); // 디버깅용
    return displayUser;
  });

  // 화면 공유 사용자 추가
  voiceChatStore.users.forEach(user => {
    if (user.screen_sharing && user.stream) {
      console.log('화면 공유 스트림 추가:', user);
      displayUsers.push({
        id: `screen-${user.user_id}`,
        nickname: `${user.username}의 화면`,
        isSpeaking: false,
        isMuted: user.muted,
        isDeafened: user.deafened,
        isVideoOn: true,
        isScreenSharing: true,
        imageUrl: user.profile_image,
        stream: user.stream
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
          {displayUsers.map(user => (
            <VideoUserBox
              key={user.id}
              user={user}
            />
          ))}
        </div>
      </div>
      <VideoControls show={showControls} />
    </div>
  );
};