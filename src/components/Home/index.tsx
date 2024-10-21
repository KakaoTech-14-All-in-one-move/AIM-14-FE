import React from 'react';
import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';
import ChatArea from '@/components/Home/ChatArea';

const Home: React.FC = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <Channelbar />
      <div className="flex-1 bg-discord500">
        <ChatArea />
      </div>
    </div>
  );
};

export default Home;