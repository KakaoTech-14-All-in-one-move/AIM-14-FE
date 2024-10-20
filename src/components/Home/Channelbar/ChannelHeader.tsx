import React from 'react';
import { ChevronDown } from 'lucide-react';

const ChannelHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-4 border-b-2 border-discord800">
      <span className="font-semibold">KTB-14조</span>
      <ChevronDown size={20} />
    </div>
  );
};

export default ChannelHeader;
