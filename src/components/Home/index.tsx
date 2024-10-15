import React from 'react';
import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';

const Home: React.FC = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <Channelbar />
      <div className="flex-1 bg-discord600">
        {/* 채팅 콘텐츠 영역 */}
      </div>
    </div>
  );
};

export default Home;