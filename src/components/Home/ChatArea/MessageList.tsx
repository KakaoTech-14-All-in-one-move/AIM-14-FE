import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import useMessageStore from '@/stores/messageStore';
import Message from '@/components/Home/ChatArea/Message';
import { useStore } from '@/stores/login';

interface GroupedMessage {
  id: string;
  author: string;
  contents: { id: string; content: string; timestamp: string }[];
  showHeader: boolean;
}

const MessageList: React.FC = () => {
  const messages = useMessageStore((state) => state.messages);
  const { username, userColors, setUserColor } = useStore();
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

  const getOrCreateUserColor = useCallback(
    (author: string) => {
      if (!userColors[author]) {
        const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
        setUserColor(author, randomColor);
        return randomColor;
      }
      return userColors[author];
    },
    [userColors, setUserColor],
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {groupedMessages.map((group) => (
        <Message
          key={group.id}
          author={group.author}
          contents={group.contents}
          showHeader={group.showHeader}
          isCurrentUser={group.author === username}
          userColor={getOrCreateUserColor(group.author)}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default React.memo(MessageList);
