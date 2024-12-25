import React, { useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ChatHeader from '@/components/Home/ChatArea/ChatHeader';
import MessageList from '@/components/Home/ChatArea/MessageList';
import ChatInput from '@/components/Home/ChatArea/ChatInput';
import { useServerStore } from '@/stores/serverStore';
import useWebSocketStore from '@/stores/webSocketStore';

const ChatArea: React.FC = () => {
  const { channelId } = useParams<{ channelId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedServerId = useServerStore((state) => state.selectedServerId);
  const { connect, disconnect } = useWebSocketStore();

  useEffect(() => {
    // 서버 ID는 있지만 채널이 없는 경우는 유효한 상태이므로 리다이렉트하지 않음
    if (!channelId && location.pathname === '/channels') {
      navigate('/home');
    }
  }, [channelId, location.pathname, navigate]);

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
      <div className="flex flex-col h-full bg-discord500 flex-grow">
        <ChatHeader channelId={channelId} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 flex justify-center">
            <div className="max-w-3xl w-full">
              <img
                src="/pitching.site_intro.png"
                alt="home screenshot"
                className="w-full h-auto"
                loading="lazy"
                onError={(e) => {
                  console.error('Image failed to load');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channelId) {
    return (
      <div className="flex flex-col h-full bg-discord500 flex-grow items-center justify-center">
        <p className="text-gray-400">채널을 생성하여 대화를 시작하세요.</p>
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