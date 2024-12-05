import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraOff, ChevronDown, HeadphoneOff, MicOff, MonitorUp, Plus } from 'lucide-react';
import { ChannelType } from '@/components/Home/Channelbar/types';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { useServerStore } from '@/stores/serverStore';
import { useChannelStore } from '@/stores/channelStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { Channel } from '@/types/server';
import { MediaType } from '@/services/call/types';
import ContextMenu from './ContextMenu';
import { ChannelNavigator } from '@/components/Provider/ChannelNavigator.ts';

interface Props {
  type: ChannelType;
  icon: React.ElementType;
}

const ChannelList: React.FC<Props> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { selectedServerId } = useServerStore();
  const channelStore = useChannelStore();
  const { user } = useAuthStore();
  const { currentUserChannel, channelUsers } = useUserChannelStore();
  const BASE_URL = import.meta.env.VITE_BE_SERVER_URL;


  const {
    channels,
    openSections,
    toggleSection,
  } = useChannels();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const currentChannels = useMemo(() => channels[type] || [], [channels, type]);

  const toggleChannelExpand = useCallback((channelName: string) => {
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelName)) {
        newSet.delete(channelName);
      } else {
        newSet.add(channelName);
      }
      return newSet;
    });
  }, []);

  const handleAddChannel = async () => {
    if (!selectedServerId) return;

    const name = prompt('채널 이름을 입력하세요:');
    if (!name) return;

    try {
      await channelStore.addChannel(selectedServerId, {
        channelName: name,
        channelCategory: type === 'text' ? 'CHAT' : type === 'voice' ? 'VOICE' : 'VIDEO',
      });
    } catch (error: any) {
      alert(error.response?.data?.message || '채널 생성에 실패했습니다.');
    }
  };

  const handleRenameChannel = async (channel: Channel) => {
    const newName = prompt('새 채널 이름을 입력하세요:', channel.channelName);
    if (!newName || newName === channel.channelName) return;

    try {
      await channelStore.updateChannelName(channel.serverId, channel.channelId, newName);
    } catch (error: any) {
      alert(error.response?.data?.message || '채널 이름 변경에 실패했습니다.');
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (!confirm(`정말로 '${channel.channelName}' 채널을 삭제하시겠습니까?`)) return;

    try {
      await channelStore.deleteChannel(channel.serverId, channel.channelId);
    } catch (error: any) {
      alert(error.response?.data?.message || '채널 삭제에 실패했습니다.');
    }
  };

  const handleChannelClick = useCallback(async (channel: Channel, isMemberClick: boolean = false) => {
    if (type === 'text') {
      navigate(`/channels/${channel.serverId}/${channel.channelId}`);
      return;
    }

    const mediaType = type.toUpperCase() as MediaType;
    if (isMemberClick) return;

    if (currentUserChannel.channelId) {
      const confirmSwitch = window.confirm(
        `현재 ${type === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`,
      );
      if (!confirmSwitch) return;

      // 현재 채널에서 나가기 전에 확장 상태 제거
      const currentChannel = currentChannels.find(c => c.channelId.toString() === currentUserChannel.channelId);
      if (currentChannel) {
        setExpandedChannels(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentChannel.channelName);
          return newSet;
        });
      }

      await ChannelNavigator.getInstance().handleChannelLeave();
    }

    const success = await ChannelNavigator.getInstance().handleChannelEnter(
      channel.channelId.toString(),
      mediaType
    );

    if (!success) {
      alert(`${type === 'voice' ? '음성' : '화상'} 채널 접속에 실패했습니다.`);
      return;
    }

    toggleChannelExpand(channel.channelName);
  }, [type, currentUserChannel.channelId, currentChannels, toggleChannelExpand, navigate]);


  const renderChannelMembers = useCallback((channel: Channel) => {
    if (!['voice', 'video'].includes(type)) return null;

    console.log('Debug channel expansion:', {
      activeChannelIds: Array.from(channelUsers.keys()),
      currentChannelId: currentUserChannel.channelId,
      currentChannels: currentChannels,
      currentExpanded: Array.from(expandedChannels)
    });

    const currentChannelUsers = channelUsers.get(channel.channelId.toString()) || [];

    return (
      <>
        {currentChannelUsers.map(member => {
          const isCurrentUser = member.userId === user?.email;
          const { isMuted, isDeafened, isCameraOn, isScreenSharing, isSpeaking } = member.mediaState;

          return (
            <div
              key={member.userId}
              className={`ml-6 mt-2 mb-2 flex items-center text-gray-400 cursor-pointer
              ${isCurrentUser ? 'bg-gray-700/30 rounded px-2' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleChannelClick(channel, true);
              }}
            >
              {member.profileImage ? (
                <img
                  src={BASE_URL + member.profileImage}
                  alt={member.username}
                  className="w-7 h-7 rounded-full mr-1"
                />
              ) : (
                <DefaultProfileImage username={member.username} size={28} margin="mr-1" />
              )}
              <span className="text-sm font-semibold">{member.username}</span>
              <div className="ml-auto mr-4 flex items-center gap-2">
                {isMuted && <MicOff size={16} className="text-red-500" />}
                {isDeafened && <HeadphoneOff size={16} className="text-red-500" />}
                {type === 'video' && !isCameraOn && (
                  <CameraOff size={16} className="text-red-500" />
                )}
                {type === 'video' && isScreenSharing && (
                  <MonitorUp size={16} className="text-green-500" />
                )}
                {isSpeaking && (
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }, [type, channelUsers, user, handleChannelClick, BASE_URL]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  // 채널 상태 모니터링
  useEffect(() => {
    if (!['voice', 'video'].includes(type)) return;

    const activeChannelIds = Array.from(channelUsers.keys());
    const currentlyInChannel = currentUserChannel.channelId !== null;

    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      currentChannels.forEach(channel => {
        const channelId = channel.channelId.toString();
        const isActiveChannel = activeChannelIds.includes(channelId);
        const isCurrentUserChannel = channelId === currentUserChannel.channelId;

        if (isActiveChannel || (isCurrentUserChannel && currentlyInChannel)) {
          newSet.add(channel.channelName);
        } else {
          newSet.delete(channel.channelName);
        }
      });
      return newSet;
    });
  }, [type, channelUsers, currentChannels, currentUserChannel.channelId]);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-gray-400 mb-1 ml-2">
        <div
          className="flex items-center cursor-pointer group"
          onClick={() => toggleSection(type)}
        >
          <ChevronDown
            size={12}
            className={`transform transition-transform ${openSections[type] ? '' : '-rotate-90'} 
              group-hover:text-gray-200`}
          />
          <span className="uppercase text-xs font-semibold ml-[0.9rem] group-hover:text-gray-200">
            {type === 'text' ? '채팅' : type === 'voice' ? '음성' : '화상'} 채널
          </span>
        </div>
        {selectedServerId && (
          <Plus
            size={13}
            className="hover:text-gray-200 mr-5 stroke-2 cursor-pointer"
            style={{ strokeWidth: 3 }}
            onClick={handleAddChannel}
          />
        )}
      </div>

      {openSections[type] && (
        <div className="space-y-1">
          {currentChannels.map((channel) => {
            const isCurrentChannel = channel.channelId.toString() === currentUserChannel.channelId;
            const hasActiveUsers = channelUsers.has(channel.channelId.toString());

            return (
              <div key={channel.channelId} className="ml-3">
                <div
                  className={`
                    flex items-center text-gray-400 hover:bg-gray-700 hover:text-gray-200 
                    px-2 py-1 rounded cursor-pointer
                    ${isCurrentChannel ? 'bg-gray-700 text-white font-semibold' : ''}
                    ${hasActiveUsers && !isCurrentChannel ? 'bg-gray-700/50' : ''}
                  `}
                  onClick={() => handleChannelClick(channel)}
                  onContextMenu={(e) => handleContextMenu(e, channel)}
                >
                  <Icon size={18} className="mr-1" />
                  <span className="flex-grow">{channel.channelName}</span>
                  {(type === 'voice' || type === 'video') && (hasActiveUsers || isCurrentChannel) && (
                    <>
                      <div className="mr-3">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                      <ChevronDown
                        size={12}
                        className={`mr-3 transform transition-transform
                          ${expandedChannels.has(channel.channelName) ? '' : '-rotate-90'}`}
                      />
                    </>
                  )}
                </div>

                {(type === 'voice' || type === 'video') &&
                  (hasActiveUsers || isCurrentChannel) &&
                  expandedChannels.has(channel.channelName) &&
                  renderChannelMembers(channel)}
              </div>
            );
          })}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            handleRenameChannel(contextMenu.channel);
            setContextMenu(null);
          }}
          onDelete={() => {
            handleDeleteChannel(contextMenu.channel);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};

export default React.memo(ChannelList);