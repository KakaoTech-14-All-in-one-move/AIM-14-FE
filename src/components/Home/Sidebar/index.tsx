import React from 'react';
import { SidebarIcon } from '@/components/Home/Sidebar/SidebarIcon'
import { Divider } from '@/components/Home/Sidebar/Divider';
import { useServerStore } from '@/hooks/useServers';
import { HomeIcon } from '@/components/Home/Sidebar/icons/HomeIcon';

const Sidebar: React.FC = () => {
    const { servers, addServer, removeServer } = useServerStore();

    return (
        <div className="fixed top-0 left-0 h-screen w-16 flex flex-col
                    bg-white dark:bg-discord900 shadow-lg">
            <SidebarIcon icon={<HomeIcon />} text="홈" />
            <Divider />
            {servers.map((server, index) => (
                <SidebarIcon
                    key={index}
                    text={server}
                    onRemove={() => removeServer(index)}
                />
            ))}
            <Divider />
            {/* TODO: 서버 만들면, 서버에 post 되도록 구현 */}
            <SidebarIcon
                icon={<span className="text-2xl">+</span>}
                text="서버 추가"
                onClick={addServer}
            />
        </div>
    );
};

export default Sidebar;