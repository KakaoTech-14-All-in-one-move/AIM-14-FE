import React, { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { generateProfileImageUrl } from '@/components/Login/DefaultProfileImage';

interface MessageProps {
  author: string;
  contents: { id: string; content: string; timestamp: string }[];
  showHeader: boolean;
  isCurrentUser: boolean;
  userColor: string;
  profile_image?: string;
}

const Message: React.FC<MessageProps> = React.memo(
  ({ author, contents, showHeader, isCurrentUser, userColor, profile_image }) => {
    const user = useAuthStore((state) => state.user);

    const formatDate = useMemo(() => {
      return (dateString: string) => {
        const date = new Date(Number(dateString));
        return new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(date);
      };
    }, []);

    const displayProfileImage = useMemo(() => {
      // 현재 사용자인 경우
      if (isCurrentUser && user) {
        if (user.profile_image) {
          return user.profile_image.startsWith('http')
            ? user.profile_image
            : `${import.meta.env.VITE_S3_URL}${user.profile_image}`;
        }
        return generateProfileImageUrl(user.username || 'User', 40);
      }

      // 다른 사용자인 경우
      if (profile_image) {
        return profile_image.startsWith('http')
          ? profile_image
          : `${import.meta.env.VITE_S3_URL}${profile_image}`;
      }

      // 프로필 이미지가 없는 경우 기본 이미지 생성
      return generateProfileImageUrl((author || 'Anonymous').split('(')[0].trim(), 40);
    }, [isCurrentUser, user, profile_image, author]);

    return (
      <div className="flex mb-4">
        {showHeader && (
          <div className="flex-shrink-0 mr-3 self-start pt-1">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden">
              <img
                src={displayProfileImage}
                alt={author}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 이미지 로드 실패 시 기본 이미지로 대체
                  e.currentTarget.src = generateProfileImageUrl(author.split('(')[0].trim(), 40);
                }}
              />
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {showHeader && (
            <div className="mb-1 flex items-baseline">
              <span className="font-bold text-gray-100 mr-2">{author}</span>
              <span className="text-xs text-gray-400">
                {formatDate(contents[0].timestamp)}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            {contents.map((content) => (
              <p key={content.id} className="text-gray-100 mb-1">
                {content.content}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

export default Message;