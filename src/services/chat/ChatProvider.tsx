// src/services/chat/ChatProvider.tsx
import React, { createContext, useContext, useEffect } from 'react';
import WebSocketService from './websocket';
import useMessageStore from '@/stores/messageStore';

interface ChatContextType {
  websocketService: WebSocketService;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const addMessage = useMessageStore((state) => state.addMessage);
  const websocketService = WebSocketService.getInstance();

  useEffect(() => {
    websocketService.connect();
    websocketService.setMessageHandler((message) => {
      addMessage({
        sender: message.sender,
        content: message.content,
        profileImage: message.profileImage,
        channelId: '', // 필요한 경우 채널 ID 추가
        type: 'TALK'
      });
    });

    return () => {
      websocketService.disconnect();
    };
  }, [addMessage]);

  return (
    <ChatContext.Provider value={{ websocketService }}>
      {children}
    </ChatContext.Provider>
  );
};