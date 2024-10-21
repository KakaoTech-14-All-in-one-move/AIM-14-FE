import React, { useMemo } from 'react';
import { useStore } from '@/stores/login';

interface MessageProps {
  author: string;
  contents: { id: string; content: string; timestamp: string }[];
  showHeader: boolean;
  isCurrentUser: boolean;
  userColor: string;
}

const Message: React.FC<MessageProps> = React.memo(
  ({ author, contents, showHeader, isCurrentUser, userColor }) => {
    const { profileImage } = useStore();

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

    const initials = useMemo(() => {
      return author.split('(')[0].split('.')[0][0].toUpperCase();
    }, [author]);

    return (
      <div className="flex mb-4">
        {showHeader && (
          <div className="flex-shrink-0 mr-3 self-start pt-1">
            {isCurrentUser ? (
              <img
                src={profileImage}
                alt={author}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: userColor }}
              >
                {initials}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {showHeader && (
            <div className="mb-1 flex items-baseline">
              <span className="font-bold text-gray-100 mr-2">{author}</span>
              <span className="text-xs text-gray-400">{formatDate(contents[0].timestamp)}</span>
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
  },
);

export default Message;
