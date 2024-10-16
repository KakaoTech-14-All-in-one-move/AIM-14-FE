import React from 'react';
import { Hash, Volume2, Monitor } from 'lucide-react';
import ChannelList from '@/components/Home/Channelbar/ChannelList';
import ChannelHeader from '@/components/Home/Channelbar/ChannelHeader';
import ChannelFooter from '@/components/Home/Channelbar/ChannelFooter';
import { ChannelProvider } from '@/components/Home/Channelbar/ChannelContext';

const Channelbar: React.FC = () => {
    return (
        <ChannelProvider>
            <div className="w-60 bg-discord700 text-white h-screen flex flex-col">
                <ChannelHeader />
                <div className="overflow-y-auto flex-grow px-x bg-discord600">
                    <ChannelList type="text" icon={Hash} />
                    <ChannelList type="voice" icon={Volume2} />
                    <ChannelList type="video" icon={Monitor} />
                </div>
                <ChannelFooter className="bg-discord800" />
            </div>
        </ChannelProvider>
    );
};

export default Channelbar;