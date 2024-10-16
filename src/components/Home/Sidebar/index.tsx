import React, { useState } from 'react';
import { SidebarIcon } from '@/components/Home/Sidebar/SidebarIcon';
import { Divider } from '@/components/Home/Sidebar/Divider';
import { useServerStore } from '@/hooks/useServers';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';

const Sidebar: React.FC = () => {
  const { servers, addServer, removeServer } = useServerStore();
  const [selectedServer, setSelectedServer] = useState<number>(-1);  // -1은 홈을 나타냄

  return (
    <div className="h-screen w-16 flex flex-col bg-discord900 shadow-lg">
      <SidebarIcon
        icon={<HomeIcon />}
        text="홈"
        isSelected={selectedServer === -1}
        onClick={() => setSelectedServer(-1)}
      />
      {servers.map((server, index) => (
        <SidebarIcon
          key={index}
          text={server}
          isSelected={selectedServer === index}
          onClick={() => setSelectedServer(index)}
          onRemove={() => {
            removeServer(index);
            if (selectedServer === index) {
              setSelectedServer(Math.max(-1, servers.length - 2)); // 삭제 후 이전 서버 선택
            }
          }}
        />
      ))}
      <SidebarIcon
        icon={<span className="text-2xl">+</span>}
        text="서버 추가"
        noLeftBar={true}
        onClick={() => {
          addServer();
          setSelectedServer(servers.length);
        }}
      />
    </div>
  );
};

export default Sidebar;