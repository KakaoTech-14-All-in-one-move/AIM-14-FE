import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CameraOff, ChevronDown, HeadphoneOff, MicOff, MonitorUp, Plus } from 'lucide-react';
import { Channel, ChannelType } from '@/components/Home/Channelbar/types';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';
import { useCall } from '@/services/call/CallProvider';
import ContextMenu from '@/components/Home/Channelbar/ContextMenu';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { useServerStore } from '@/stores/serverStore';
import { useChannelStore } from '@/stores/channelStore';
import { Channel } from '@/types/server';

interface Props {
  type: ChannelType;
  icon: React.ElementType;
}

const ChannelList: React.FC<Props> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const voiceChatStore = useVoiceChat();
  const { connection } = useCall();
  const { selectedServerId } = useServerStore();
  const channelStore = useChannelStore();

  const {
    channels,
    channelStates,
    openSections,
    toggleSection,
    activateChannel,
    deactivateChannel,
    joinChannel,
    leaveChannel
  } = useChannels();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  // 현재 타입의 채널들 메모이제이션
  const currentChannels = useMemo(() => channels[type] || [], [channels, type]);

  const toggleChannelExpand = useCallback((channelId: string) => {
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
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
        channelCategory: type === 'text' ? 'CHAT' : type === 'voice' ? 'VOICE' : 'VIDEO'
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '채널 생성에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const handleRenameChannel = async (channel: Channel) => {
    const newName = prompt('새 채널 이름을 입력하세요:', channel.channelName);
    if (!newName || newName === channel.channelName) return;

    try {
      await channelStore.updateChannelName(channel.serverId, channel.channelId, newName);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '채널 이름 변경에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (!confirm(`정말로 '${channel.channelName}' 채널을 삭제하시겠습니까?`)) return;

    try {
      await channelStore.deleteChannel(channel.serverId, channel.channelId);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '채널 삭제에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const handleChannelClick = useCallback((channel: Channel) => {
    if (type === 'text') {
      navigate(`/channels/${channel.serverId}/${channel.channelId}`);
      return;
    }

    const mediaType = type as 'voice' | 'video';
    const isJoined = channelStates[mediaType]?.joined[channel.channelName] || false;

    if (isJoined) {
      toggleChannelExpand(channel.channelName);
      return;
    }

    const hasActiveChannel = Object.entries(channelStates[mediaType]?.joined || {})
      .some(([name, joined]) => joined);

    if (hasActiveChannel) {
      const confirmSwitch = window.confirm(
        `현재 ${mediaType === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`
      );

      if (!confirmSwitch) return;

      Object.entries(channelStates[mediaType]?.joined || {}).forEach(([name, joined]) => {
        if (joined) {
          leaveChannel(mediaType, name);
          connection?.leaveChannel();
        }
      });
    }

    joinChannel(mediaType, channel.channelName);
    connection?.joinChannel(channel.channelId.toString(), mediaType.toUpperCase());
    navigate(`/${mediaType}/${channel.channelId}`);
    toggleChannelExpand(channel.channelName);
  }, [type, channelStates, connection, navigate, joinChannel, leaveChannel, toggleChannelExpand]);

  const renderChannelMembers = useCallback((channel: Channel) => {
    if (!['voice', 'video'].includes(type)) return null;

    const channelMembers = voiceChatStore.users.filter(member =>
      member.channel_id === channel.channelId.toString() &&
      member.channel_type === type.toUpperCase()
    );

    return (
      <>
        {channelMembers.map(member => (
          <div
            key={member.user_id}
            className="ml-6 mt-2 mb-2 flex items-center text-gray-400"
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
              {member.muted && <MicOff size={16} className="text-red-500" />}
              {member.deafened && <HeadphoneOff size={16} className="text-red-500" />}
              {type === 'video' && !member.camera_on && <CameraOff size={16} className="text-red-500" />}
              {type === 'video' && member.screen_sharing && <MonitorUp size={16} className="text-green-500" />}
            </div>
          </div>
        ))}
      </>
    );
  }, [type, voiceChatStore.users]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  // 채널 상태 모니터링
  useEffect(() => {
    if (!['voice', 'video'].includes(type)) return;

    const activeChannelUsers = new Map<string, string[]>();

    // 각 채널별 활성 사용자 수집
    voiceChatStore.users.forEach(user => {
      if (user.channel_type === type.toUpperCase()) {
        const channelId = user.channel_id.toString();
        const currentUsers = activeChannelUsers.get(channelId) || [];
        activeChannelUsers.set(channelId, [...currentUsers, user.user_id]);
      }
    });

    // 현재 채널들의 상태 업데이트
    currentChannels.forEach(channel => {
      const hasUsers = activeChannelUsers.has(channel.channelId.toString());
      if (hasUsers) {
        activateChannel(type, channel.channelName);
        setExpandedChannels(prev => {
          const newSet = new Set(prev);
          newSet.add(channel.channelName);
          return newSet;
        });
      } else {
        deactivateChannel(type, channel.channelName);
      }
    });
  }, [type, voiceChatStore.users, currentChannels, activateChannel, deactivateChannel]);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-gray-400 mb-1 ml-2">
        <div className="flex items-center">
          <ChevronDown
            size={12}
            className={`transform transition-transform ${openSections[type] ? '' : '-rotate-90'} cursor-pointer`}
            onClick={() => toggleSection(type)}
          />
          <span className="uppercase text-xs font-semibold ml-[0.9rem]">
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

      {openSections[type] && currentChannels.map((channel) => (
        <div key={channel.channelId} className="mb-1 ml-3">
          <div
            className={`flex items-center text-gray-400 hover:bg-gray-700 hover:text-gray-200 px-2 py-1 rounded cursor-pointer ${channelStates[type as 'voice' | 'video']?.active?.[channel.channelName] ? 'bg-gray-700' : ''
              } ${channelStates[type as 'voice' | 'video']?.joined?.[channel.channelName] ? 'text-white font-semibold' : ''
              }`}
            onClick={() => handleChannelClick(channel)}
            onContextMenu={(e) => handleContextMenu(e, channel)}
          >
            <Icon size={18} className="mr-1" />
            <span className="flex-grow">{channel.channelName}</span>
            {(type === 'voice' || type === 'video') && (
              channelStates[type]?.active?.[channel.channelName] ||
              channelStates[type]?.joined?.[channel.channelName]
            ) && (
                <>
                  <div className="mr-3">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <ChevronDown
                    size={12}
                    className={`mr-3 transform transition-transform ${expandedChannels.has(channel.channelName) ? '' : '-rotate-90'
                      }`}
                  />
                </>
              )}
          </div>

          {(type === 'voice' || type === 'video') &&
            (channelStates[type]?.active?.[channel.channelName] ||
              channelStates[type]?.joined?.[channel.channelName]) &&
            expandedChannels.has(channel.channelName) &&
            renderChannelMembers(channel)}
        </div>
      ))}

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