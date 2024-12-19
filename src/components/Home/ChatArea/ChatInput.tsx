// src/components/Home/ChatArea/ChatInput.tsx
import React, { useState } from 'react';
import useWebSocketStore from '@/stores/webSocketStore';
import { useAuthStore } from '@/stores/authStore';

interface ChatInputProps {
  channelId: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ channelId }) => {
  const [message, setMessage] = useState('');
  const user = useAuthStore((state) => state.user);
  const { sendMessage, isConnected } = useWebSocketStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && user && isConnected[channelId]) {
      console.log('Sending message with user:', user); // 디버깅용 로그 추가
      sendMessage(channelId, message.trim(), {
        id: user.email,  // id 대신 email 사용
        username: user.username,
        profile_image: user.profile_image
      });
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-discord500">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={isConnected[channelId] ? `메시지를 입력하세요` : '연결 중...'}
        disabled={!isConnected[channelId]}
        className="w-full bg-discord700 text-gray-100 px-4 py-2 rounded focus:outline-none placeholder-gray-400"
      />
    </form>
  );
};

export default ChatInput;