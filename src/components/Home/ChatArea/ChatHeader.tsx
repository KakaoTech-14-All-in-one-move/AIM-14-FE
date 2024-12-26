import React, { useMemo } from 'react';
import { FaSearch } from 'react-icons/fa';
import FeedbackIcon from '@/common/icons/feedback';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChannelStore } from '@/stores/channelStore';

interface ChatHeaderProps {
  channelId?: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ channelId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const channels = useChannelStore((state) => state.channels);

  const currentChannel = useMemo(() => {
    if (location.pathname === '/home' || !channelId || !channels) {
      return { channelName: 'home' };
    }
    return channels.find(channel => channel.channelId.toString() === channelId);
  }, [channelId, channels, location.pathname]);

  const handleRecordClick = () => {
    navigate('/record');
  };

  return (
    <div className="flex items-center justify-between p-3 bg-discord500 border-b border-discord900">
      <div className="flex items-center">
        <h2 className="text-gray-100 font-semibold mr-2 text-lg">
          # {currentChannel?.channelName || 'home'}
        </h2>
      </div>
      <div className="flex items-center">
        <button
          onClick={handleRecordClick}
          className="bg-[#FEE500] hover:bg-yellow-400 text-[#3B1E1E] mr-4 p-1 rounded-full flex items-center justify-center transition-colors duration-200"
          title="녹화하기"
        >
          <FeedbackIcon />
        </button>
        <input
          type="text"
          placeholder="검색"
          className="bg-discord800 text-gray-100 px-2 py-1 rounded mr-2 placeholder-gray-400"
        />
        <FaSearch className="text-gray-400" />
      </div>
    </div>
  );
};

export default ChatHeader;