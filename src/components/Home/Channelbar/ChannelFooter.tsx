import React from 'react';
import { Settings } from 'lucide-react';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';

const ChannelFooter: React.FC = () => {
    const { currentUser } = useChannels();

    return (
        <div className="p-3">
            <div className="flex items-center justify-between text-gray-400">
                <div className="flex items-center">
                    <img src={currentUser.profileImage} alt={currentUser.nickname} className="w-8 h-8 rounded-full mr-2" />
                    <span>{currentUser.nickname}</span>
                </div>
                <Settings size={18} className="cursor-pointer hover:text-gray-200" />
            </div>
        </div>
    );
};

export default ChannelFooter;