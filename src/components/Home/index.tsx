import React from 'react';
import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';
import ChatArea from '@/components/Home/ChatArea';

const Home: React.FC = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <Channelbar />
      <ChatArea />
    </div>
  );
};

export default Home;