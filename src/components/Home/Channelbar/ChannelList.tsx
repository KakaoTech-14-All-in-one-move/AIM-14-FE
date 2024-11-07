import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, HeadphoneOff, MicOff, Plus } from 'lucide-react';
import { ChannelType } from './types';
import { useChannels } from './ChannelContext';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuthStore } from '@/stores/authStore';
import { useCall } from '@/services/call/CallProvider';
import { TEMP_CHANNEL_MAPPING } from '@/services/call/constants';
import ContextMenu from './ContextMenu';

const GENERAL_VOICE_CHANNEL_ID = '5143992e-9dcd-45fe-bcc7-e337417b0cfe';
const DEFAULT_PROFILE_IMAGE = '/kakao_login_logo.png';

const ChannelList: React.FC<{ type: ChannelType; icon: React.ElementType }> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const { isMuted, isDeafened } = useVoiceChat();
  const {
    channels,
    addChannel,
    openSections,
    toggleSection,
    activeChannels,
    joinChannel,
    leaveChannel,
    renameChannel,
    deleteChannel,
  } = useChannels();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: string } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const user = useAuthStore(state => state.user);
  const { connection, users } = useCall();

  // 초기 채널 설정
  useEffect(() => {
    if (channelId === GENERAL_VOICE_CHANNEL_ID && type === 'voice') {
      joinChannel(type, '일반');
      setExpandedChannels(new Set(['일반']));
    }
  }, []);

  useEffect(() => {
    if (users && users.length > 0 && type === 'voice') {
      const voiceChannelUsers = users.filter(user =>
        user.channel_type === 'VOICE' &&
        user.channel_id === GENERAL_VOICE_CHANNEL_ID,
      );

      if (voiceChannelUsers.length > 0) {
        // 채널 확장
        setExpandedChannels(prev => new Set([...prev, '일반']));

        // 채널 활성화 (누군가 채널에 있다면)
        joinChannel('voice', '일반');
      }
    }
  }, [users]);

  useEffect(() => {
    if (type === 'voice' && users) {
      const hasUsersInVoiceChannel = users.some(user =>
        user.channel_type === 'VOICE' &&
        user.channel_id === GENERAL_VOICE_CHANNEL_ID,
      );

      if (hasUsersInVoiceChannel) {
        joinChannel('voice', '일반');
        setExpandedChannels(prev => new Set([...prev, '일반']));
      } else {
        // 채널에 아무도 없으면 비활성화 (선택사항)
        // leaveChannel('voice', '일반');
      }
    }
  }, [users, type]);

  const toggleChannelExpand = (channelName: string) => {
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelName)) {
        newSet.delete(channelName);
      } else {
        newSet.add(channelName);
      }
      return newSet;
    });
  };

  const renderChannelMembers = (channelName: string) => {
    if (type !== 'voice' || channelName !== TEMP_CHANNEL_MAPPING.channelName || !users) {
      return null;
    }

    const channelMembers = users.filter(member =>
      member.channel_id === TEMP_CHANNEL_MAPPING.channelId &&
      member.server_id === TEMP_CHANNEL_MAPPING.serverId &&
      member.user_id !== user?.id,  // 현재 사용자 제외
    );

    if (channelMembers.length === 0) return null;

    return channelMembers.map(member => (
      <div
        key={member.user_id}
        className="ml-6 mt-2 mb-2 flex items-center text-gray-400"
      >
        <img
          src={DEFAULT_PROFILE_IMAGE}
          alt={member.username}
          className="w-5 h-5 rounded-full mr-2"
        />
        <span className="text-sm font-semibold">{member.username}</span>
        <div className="ml-auto mr-4 flex items-center gap-2">
          {member.muted && <MicOff size={16} className="text-red-500" />}
          {member.deafened && <HeadphoneOff size={16} className="text-red-500" />}
        </div>
      </div>
    ));
  };

  const isCurrentUserInChannel = (channelName: string) => {
    if (!users || type !== 'voice') return false;

    return users.some(user =>
      user.user_id === user?.id &&
      user.channel_id === GENERAL_VOICE_CHANNEL_ID &&
      channelName === '일반'
    );
  };

  const handleChannelClick = async (channelName: string) => {
    if (type !== 'voice' && type !== 'video') return;

    toggleChannelExpand(channelName);

    // 이미 활성화된 채널이면 토글만 하고 리턴
    if (activeChannels[type][channelName]) {
      return;
    }

    const handleJoinChannel = async () => {
      await joinChannel(type, channelName);
      if (type === 'voice' && channelName === '일반') {
        // 실제 음성 채널 연결은 여기서만 수행
        connection?.joinChannel(GENERAL_VOICE_CHANNEL_ID, 'VOICE');
        navigate(`/voice/${GENERAL_VOICE_CHANNEL_ID}`);
      }
    };

    const otherType = type === 'voice' ? 'video' : 'voice';
    const hasActiveOtherChannel = Object.values(activeChannels[otherType]).some(active => active);

    if (!hasActiveOtherChannel) {
      await handleJoinChannel();
      return;
    }

    const confirmSwitch = window.confirm(
      `현재 ${otherType === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`,
    );

    if (!confirmSwitch) return;

    // 활성화된 다른 채널들 종료
    Object.entries(activeChannels[otherType]).forEach(([channel, active]) => {
      if (active) {
        leaveChannel(otherType, channel);
        connection?.leaveChannel();
      }
    });

    await handleJoinChannel();
  };

  const handleContextMenu = (e: React.MouseEvent, channel: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const handleRenameChannel = () => {
    if (contextMenu) {
      const newName = prompt('새 채널 이름을 입력하세요:', contextMenu.channel);
      if (newName && newName !== contextMenu.channel) {
        renameChannel(type, contextMenu.channel, newName);
      }
      setContextMenu(null);
    }
  };

  const handleDeleteChannel = () => {
    if (contextMenu) {
      if (window.confirm(`정말로 '${contextMenu.channel}' 채널을 삭제하시겠습니까?`)) {
        deleteChannel(type, contextMenu.channel);
      }
      setContextMenu(null);
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-gray-400 mb-1 cursor-pointer ml-2"
           onClick={() => toggleSection(type)}>
        <div className="flex items-center">
          <ChevronDown
            size={12}
            className={`transform transition-transform ${openSections[type] ? '' : '-rotate-90'}`}
          />
          <span className="uppercase text-xs font-semibold ml-[0.9rem]">
            {type === 'text' ? '채팅' : type === 'voice' ? '음성' : '화상'} 채널
          </span>
        </div>
        <Plus
          size={13}
          className="hover:text-gray-200 mr-5 stroke-2"
          style={{ strokeWidth: 3 }}
          onClick={(e) => {
            e.stopPropagation();
            addChannel(type, `New ${type} channel`);
          }}
        />
      </div>

      {openSections[type] && channels[type].map((channel: string) => (
        <div key={channel} className="mb-1 ml-3">
          <div
            className={`flex items-center text-gray-400 hover:bg-gray-700 hover:text-gray-200 px-2 py-1 rounded cursor-pointer ${
              type !== 'text' && activeChannels[type][channel] ? 'bg-gray-700 text-white' : ''
            }`}
            onClick={() => handleChannelClick(channel)}
            onContextMenu={(e) => handleContextMenu(e, channel)}
          >
            <Icon size={18} className="mr-1" />
            <span className="flex-grow">{channel}</span>
            {(type === 'voice' || type === 'video') && activeChannels[type][channel] && (
              <>
                <div className="mr-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <ChevronDown
                  size={12}
                  className={`mr-3 transform transition-transform ${expandedChannels.has(channel) ? '' : '-rotate-90'}`}
                />
              </>
            )}
          </div>

          {(type === 'voice' || type === 'video') &&
            activeChannels[type][channel] &&
            expandedChannels.has(channel) && (
              <>
                {isCurrentUserInChannel(channel) && (
                  <div className="ml-6 mt-1 flex items-center text-gray-400">
                    <img
                      src={user?.profile_image || DEFAULT_PROFILE_IMAGE}
                      alt={user?.username}
                      className="w-5 h-5 rounded-full mr-2"
                    />
                    <span className="text-sm font-semibold">{user?.username}</span>
                    <div className="ml-auto mr-4 flex items-center gap-2">
                      {isMuted && <MicOff size={16} className="text-red-500" />}
                      {isDeafened && <HeadphoneOff size={16} className="text-red-500" />}
                    </div>
                  </div>
                )}

                {/* 다른 채널 멤버들 표시 */}
                {renderChannelMembers(channel)}
              </>
            )}
        </div>
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={handleRenameChannel}
          onDelete={handleDeleteChannel}
        />
      )}
    </div>
  );
};

export default ChannelList;