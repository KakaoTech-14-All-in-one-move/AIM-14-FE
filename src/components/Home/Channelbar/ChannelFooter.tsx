import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import UserSettingsModal from '@/components/Home/Channelbar/UserSettingsModal';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';

const ChannelFooter: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="p-3 bg-discord800">
        <div className="flex items-center justify-between text-gray-400">
          <div className="flex items-center">
            <div className="relative mr-2">
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.username}
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <DefaultProfileImage username={user.username} size={28} />
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-discord800"></div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold leading-none">{user.username}</span>
              <span className="text-xs leading-none mt-px">온라인</span>
            </div>
          </div>
          <Settings
            size={21}
            className="cursor-pointer hover:text-gray-200"
            onClick={() => setIsSettingsOpen(true)}
          />
        </div>
      </div>

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

export default ChannelFooter;