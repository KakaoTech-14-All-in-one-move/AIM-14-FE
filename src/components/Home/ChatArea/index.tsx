import React from 'react';
import ChatHeader from '@/components/Home/ChatArea/ChatHeader';
import MessageList from '@/components/Home/ChatArea/MessageList';
import ChatInput from '@/components/Home/ChatArea/ChatInput';

const ChatArea: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-discord500">
            <ChatHeader />
            <MessageList />
            <ChatInput />
        </div>
    );
};

export default ChatArea;