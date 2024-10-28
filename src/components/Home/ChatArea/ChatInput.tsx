import React, { useState } from 'react';
import useMessageStore from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';  // import 수정

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const addMessage = useMessageStore((state) => state.addMessage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);  // isAuthenticated 사용

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && isAuthenticated) {  // isAuthenticated 사용
      addMessage({
        author: username,
        content: message.trim(),
      });
      setMessage('');
    }
  };

  if (!isAuthenticated) {  // isAuthenticated 사용
    return <div className="p-4 bg-discord700 text-gray-100">로그인이 필요합니다.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-discord500">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="#💬-일반에 메시지 보내기"
        className="w-full bg-discord700 text-gray-100 px-4 py-2 rounded focus:outline-none placeholder-gray-400"
      />
    </form>
  );
};

export default ChatInput;