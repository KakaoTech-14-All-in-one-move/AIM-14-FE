import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraOff, ChevronDown, HeadphoneOff, MicOff, MonitorUp, Plus } from 'lucide-react';
import { ChannelType } from '@/components/Home/Channelbar/types';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';
import { useMediaConnection } from '@/hooks/useMediaConnection';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { useServerStore } from '@/stores/serverStore';
import { useChannelStore } from '@/stores/channelStore';
import { useUserStore } from '@/stores/userStore';
import { useMediaChatStore } from '@/stores/useMediaChatStore';
import { Channel } from '@/types/server';
import ContextMenu from './ContextMenu';

interface Props {
  type: ChannelType;
  icon: React.ElementType;
}

const ChannelList: React.FC<Props> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { selectedServerId } = useServerStore();
  const channelStore = useChannelStore();
  const userStore = useUserStore();
  const mediaChatStore = useMediaChatStore();
  const { joinChannel, leaveChannel, currentChannelId } = useMediaConnection();
  const {
    channels,
    openSections,
    toggleSection,
  } = useChannels();

  // MediaChat 관련 상태들을 직접 store에서 가져오기
  const userStates = mediaChatStore.userStates;
  const speakingUsers = mediaChatStore.speakingUsers;
  const currentUserId = mediaChatStore.currentUserId;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  // 현재 타입의 채널들
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

  // 채널 관리 함수들
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

    const mediaType = type.toUpperCase() as 'VOICE' | 'VIDEO';

    // 멤버를 클릭한 경우는 채널 전환을 하지 않음
    if (isMemberClick) {
      return;
    }

    // 다른 채널에 이미 접속해 있는 경우
    if (currentChannelId) {
      const confirmSwitch = window.confirm(
        `현재 ${type === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`,
      );
      if (!confirmSwitch) return;

      await leaveChannel();
    }

    // 새 채널 입장
    const success = await joinChannel(channel.channelId.toString(), mediaType);
    if (success) {
      // navigate(`/${type}/${channel.channelId}`);
      toggleChannelExpand(channel.channelName);
    }
  }, [type, currentChannelId, joinChannel, leaveChannel, navigate, toggleChannelExpand]);

  const renderChannelMembers = useCallback((channel: Channel) => {
    if (!['voice', 'video'].includes(type)) return null;

    const channelMembers = userStore.users.filter(member =>
      member.channel_id === channel.channelId.toString() &&
      member.channel_type === type.toUpperCase(),
    );

    return (
      <>
        {channelMembers.map(member => {
          const memberState = userStates.get(member.user_id);

          return (
            <div
              key={member.user_id}
              className={`ml-6 mt-2 mb-2 flex items-center text-gray-400 cursor-pointer
              ${member.user_id === currentUserId ? 'bg-gray-700/30 rounded px-2' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleChannelClick(channel, true);
              }}
            >
              {member.profile_image ? (
                <img
                  src={`${import.meta.env.VITE_BE_SERVER_URL}${member.profile_image}`}
                  alt={member.username}
                  className="w-5 h-5 rounded-full mr-2"
                />
              ) : (
                <DefaultProfileImage username={member.username} size={20} margin="mr-1" />
              )}
              <span className="text-sm font-semibold">{member.username}</span>
              <div className="ml-auto mr-4 flex items-center gap-2">
                {memberState?.muted && <MicOff size={16} className="text-red-500" />}
                {memberState?.deafened && <HeadphoneOff size={16} className="text-red-500" />}
                {type === 'video' && !memberState?.cameraOn && (
                  <CameraOff size={16} className="text-red-500" />
                )}
                {type === 'video' && memberState?.screenSharing && (
                  <MonitorUp size={16} className="text-green-500" />
                )}
                {speakingUsers.has(member.user_id) && (
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }, [type, userStore.users, userStates, currentUserId, speakingUsers, handleChannelClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  // 채널 상태 모니터링
  useEffect(() => {
    if (!['voice', 'video'].includes(type)) return;

    const activeChannels = new Set(
      userStore.users
        .filter(user => user.channel_type === type.toUpperCase())
        .map(user => user.channel_id),
    );

    // 활성 채널 자동 확장
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      currentChannels.forEach(channel => {
        if (activeChannels.has(channel.channelId.toString())) {
          newSet.add(channel.channelName);
        }
      });
      return newSet;
    });
  }, [type, userStore.users, currentChannels]);

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
            const isCurrentChannel = channel.channelId.toString() === currentChannelId;
            const hasActiveUsers = userStore.users.some(
              user => user.channel_id === channel.channelId.toString() &&
                user.channel_type === type.toUpperCase(),
            );

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

export default ChannelList;