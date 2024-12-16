// MessageList.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import useWebSocketStore from '@/stores/webSocketStore';
import Message from '@/components/Home/ChatArea/Message';
import { useAuthStore } from '@/stores/authStore';

interface MessageListProps {
  channelId?: string;
}

const MessageList: React.FC<MessageListProps> = ({ channelId }) => {
  const messages = useWebSocketStore((state) => channelId ? state.messages[channelId] : []);
  const isConnected = useWebSocketStore((state) => state.isConnected);
  const user = useAuthStore((state) => state.user);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const groupedMessages = useMemo(() => {
    if (!messages?.length) return [];

    return messages.reduce((acc, message, index, array) => {
      const showHeader = index === 0 || message.sender !== array[index - 1].sender;

      if (showHeader) {
        acc.push({
          id: `${message.messageId}-${Date.now()}-group`,
          author: message.senderName,
          sender: message.sender,
          profile_image: message.profile_image,
          contents: [{
            id: message.messageId,
            content: message.message,
            timestamp: message.timestamp.toString()
          }],
          showHeader: true,
        });
      } else {
        const lastGroup = acc[acc.length - 1];
        lastGroup.contents.push({
          id: message.messageId,
          content: message.message,
          timestamp: message.timestamp.toString(),
        });
      }
      return acc;
    }, [] as any[]);
  }, [messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupedMessages]);

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>채널을 선택하여 대화를 시작하세요.</p>
      </div>
    );
  }

  if (!isConnected[channelId]) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>연결 중...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {groupedMessages.map((group) => (
        <Message
          key={group.id}
          author={group.author}
          contents={group.contents}
          showHeader={group.showHeader}
          isCurrentUser={user ? group.sender === user.email : false}
          userColor="#ffffff"
          profile_image={group.profile_image}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default React.memo(MessageList);