import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import useMessageStore from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import Message from '@/components/Home/ChatArea/Message';

interface GroupedMessage {
  id: string;
  author: string;
  profile_image?: string;  // profile_image 추가
  contents: { id: string; content: string; timestamp: string }[];
  showHeader: boolean;
}

const MessageList: React.FC = () => {
  const messages = useMessageStore((state) => state.messages);
  const user = useAuthStore((state) => state.user);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const groupedMessages: GroupedMessage[] = useMemo(() => {
    return messages.reduce((acc, message, index, array) => {
      if (index === 0 || message.author !== array[index - 1].author) {
        acc.push({
          id: message.id,
          author: message.author,
          profile_image: message.profile_image,  // profile_image 포함
          contents: [{ id: message.id, content: message.content, timestamp: message.timestamp }],
          showHeader: true,
        });
      } else {
        acc[acc.length - 1].contents.push({
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
        });
      }
      return acc;
    }, [] as GroupedMessage[]);
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {groupedMessages.map((group) => (
        <Message
          key={group.id}
          author={group.author}
          contents={group.contents}
          showHeader={group.showHeader}
          isCurrentUser={user ? group.author === user.username : false}
          userColor="#ffffff"
          profile_image={group.profile_image}  // profile_image 전달
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default React.memo(MessageList);