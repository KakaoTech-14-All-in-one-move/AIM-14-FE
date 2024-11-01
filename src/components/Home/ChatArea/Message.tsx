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
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      };
    }, []);

    const displayProfileImage = useMemo(() => {
      if (isCurrentUser) {
        return user?.profile_image || generateProfileImageUrl(user?.username, 40);
      }
      return profile_image || generateProfileImageUrl(author.split('(')[0], 40);
    }, [isCurrentUser, user, profile_image, author]);

    return (
      <div className="flex mb-4">
        {showHeader && (
          <div className="flex-shrink-0 mr-3 self-start pt-1">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden">
              {profile_image ? (
                <img
                  src={profile_image}
                  alt={author}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = generateProfileImageUrl(author.split('(')[0], 40);
                  }}
                />
              ) : (
                <img
                  src={displayProfileImage}
                  alt={author}
                  className="w-full h-full object-cover"
                />
              )}
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