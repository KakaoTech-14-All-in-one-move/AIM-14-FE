
import React, { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ChatHeader from '@/components/Home/ChatArea/ChatHeader';
import MessageList from '@/components/Home/ChatArea/MessageList';
import ChatInput from '@/components/Home/ChatArea/ChatInput';
import { useServerStore } from '@/stores/serverStore';
import useWebSocketStore from '@/stores/webSocketStore';

const ChatArea: React.FC = () => {
  const { channelId } = useParams<{ channelId?: string }>();
  const location = useLocation();
  const selectedServerId = useServerStore((state) => state.selectedServerId);
  const { connect, disconnect } = useWebSocketStore();

  useEffect(() => {
    if (channelId && location.pathname !== '/home' && selectedServerId) {
      connect(channelId);

      return () => {
        disconnect(channelId);
      };
    }
  }, [channelId, location.pathname, selectedServerId]);

  if (location.pathname === '/home') {
    return (
      <div className="flex flex-col h-full bg-discord500 flex-grow items-center justify-center">
        <p className="text-gray-400">서버를 선택하여 대화를 시작하세요.</p>
      </div>
    );
  }

  if (!channelId) {
    return (
      <div className="flex flex-col h-full bg-discord500 flex-grow items-center justify-center">
        <p className="text-gray-400">채널을 선택하여 대화를 시작하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-discord500 flex-grow">
      <ChatHeader channelId={channelId} />
      <MessageList channelId={channelId} />
      <ChatInput channelId={channelId} />
    </div>
  );
};

export default ChatArea;