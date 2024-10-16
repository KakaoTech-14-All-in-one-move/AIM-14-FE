import React from 'react';
import { Settings } from 'lucide-react';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';

const ChannelFooter: React.FC = () => {
    const { currentUser } = useChannels();

    return (
        <div className="p-3 bg-discord800">
            <div className="flex items-center justify-between text-gray-400">
                <div className="flex items-center">
                    <img src={currentUser.profileImage} alt={currentUser.nickname} className="w-7 h-7 rounded-full mr-2" />
                    <div className="flex flex-col leading-tight">
                        <span className='text-sm font-bold leading-none'>{currentUser.nickname}</span>
                        <span className='text-xs leading-none mt-px'>온라인</span>
                    </div>
                </div>
                <Settings size={21} className="cursor-pointer hover:text-gray-200" />
            </div>
        </div>
    );
};

export default ChannelFooter;