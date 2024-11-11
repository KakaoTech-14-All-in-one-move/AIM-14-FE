// components/Home/Channelbar/ChannelList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, HeadphoneOff, MicOff, Camera, MonitorUp, Plus, CameraOff } from 'lucide-react';
import { ChannelType } from './types';
import { useChannels } from './ChannelContext';
import { useCall } from '@/services/call/CallProvider';
import ContextMenu from './ContextMenu';
import { useVoiceChat } from '@/hooks/useVoiceChat';

const GENERAL_VOICE_CHANNEL_ID = '5143992e-9dcd-45fe-bcc7-e337417b0cfe';
const GENERAL_VIDEO_CHANNEL_ID = '6143992e-9dcd-45fe-bcc7-e337417b0cfe';
const DEFAULT_PROFILE_IMAGE = '/kakao_login_logo.png';

const ChannelList: React.FC<{ type: ChannelType; icon: React.ElementType }> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const {
    channels,
    addChannel,
    openSections,
    toggleSection,
    channelStates,
    activateChannel,
    deactivateChannel,
    joinChannel,
    leaveChannel,
    renameChannel,
    deleteChannel,
  } = useChannels();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: string } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const { connection, users } = useCall();
  const voiceChatStore = useVoiceChat();

  // 채널 상태 모니터링
  useEffect(() => {
    if (!channelStates) return; // 초기 상태 체크 추가

    const currentChannelId = type === 'voice' ? GENERAL_VOICE_CHANNEL_ID : GENERAL_VIDEO_CHANNEL_ID;
    if (channelId === currentChannelId && (type === 'voice' || type === 'video')) {
      joinChannel(type, '일반');
      setExpandedChannels(new Set(['일반']));
    }

    if (['voice', 'video'].includes(type)) {
      const channelUsers = voiceChatStore.users.filter(user =>
        user.channel_type === type.toUpperCase() &&
        user.channel_id === currentChannelId
      );

      if (channelUsers.length > 0) {
        activateChannel(type, '일반');
        setExpandedChannels(prev => new Set([...prev, '일반']));
      } else {
        deactivateChannel(type, '일반');
        setExpandedChannels(prev => {
          const newSet = new Set(prev);
          newSet.delete('일반');
          return newSet;
        });
      }
    }
  }, [channelId, voiceChatStore.users, type, channelStates]);


  const renderChannelMembers = (channelName: string) => {
    if (!['voice', 'video'].includes(type) || channelName !== '일반') {
      return null;
    }

    const currentChannelId = type === 'voice' ? GENERAL_VOICE_CHANNEL_ID : GENERAL_VIDEO_CHANNEL_ID;
    const channelMembers = voiceChatStore.users.filter(member =>
      member.channel_id === currentChannelId &&
      member.channel_type === type.toUpperCase()
    );

    return (
      <>
        {channelMembers.map(member => (
          <div
            key={member.user_id}
            className="ml-6 mt-2 mb-2 flex items-center text-gray-400"
          >
            <img
              src={member.profile_image || DEFAULT_PROFILE_IMAGE}
              alt={member.username}
              className="w-5 h-5 rounded-full mr-2"
            />
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
  };

  // ChannelList.tsx
  const handleChannelClick = async (channelName: string) => {
    if (type !== 'voice' && type !== 'video') return;
    if (!channelStates) return; // 초기 상태 체크 추가

    const mediaType = type as Exclude<ChannelType, 'text'>;
    const currentChannelId = type === 'voice' ? GENERAL_VOICE_CHANNEL_ID : GENERAL_VIDEO_CHANNEL_ID;

    // 이미 참여중인 경우
    if (channelStates[mediaType]?.joined?.[channelName]) {
      toggleChannelExpand(channelName);
      return;
    }

    // 다른 채널에 이미 참여중인지 확인
    const currentJoinedState = channelStates[mediaType]?.joined ?? {};
    const hasActiveOtherChannel = Object.entries(currentJoinedState)
      .some(([name, joined]) => name !== channelName && joined);

    if (hasActiveOtherChannel) {
      const confirmSwitch = window.confirm(
        `현재 ${mediaType === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`,
      );

      if (!confirmSwitch) return;

      // 현재 채널에서 나가기
      Object.entries(currentJoinedState).forEach(([name, joined]) => {
        if (joined) {
          leaveChannel(mediaType, name);
          connection?.leaveChannel();
        }
      });
    }

    // 채널 참여
    if (channelName === '일반') {
      joinChannel(mediaType, channelName);
      connection?.joinChannel(currentChannelId, mediaType.toUpperCase());
      navigate(`/${mediaType}/${currentChannelId}`);
      toggleChannelExpand(channelName);
    }
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

  return (
    <div className="mt-5">
      {/* 채널 섹션 헤더 */}
      <div
        className="flex items-center justify-between text-gray-400 mb-1 cursor-pointer ml-2"
        onClick={() => toggleSection(type)}
      >
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

      {/* 채널 목록 */}
      {openSections[type] && channels[type].map((channel: string) => (
        <div key={channel} className="mb-1 ml-3">
          <div
            className={`flex items-center text-gray-400 hover:bg-gray-700 hover:text-gray-200 px-2 py-1 rounded cursor-pointer ${
              channelStates?.[type as 'voice' | 'video']?.active?.[channel] ? 'bg-gray-700' : ''
            } ${
              channelStates?.[type as 'voice' | 'video']?.joined?.[channel] ? 'text-white font-semibold' : ''
            }`}
            onClick={() => handleChannelClick(channel)}
            onContextMenu={(e) => handleContextMenu(e, channel)}
          >
            <Icon size={18} className="mr-1" />
            <span className="flex-grow">{channel}</span>
            {(type === 'voice' || type === 'video') && (
              channelStates?.[type]?.active?.[channel] || channelStates?.[type]?.joined?.[channel]
            ) && (
              <>
                <div className="mr-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <ChevronDown
                  size={12}
                  className={`mr-3 transform transition-transform ${
                    expandedChannels.has(channel) ? '' : '-rotate-90'
                  }`}
                />
              </>
            )}
          </div>

          {/* 채널 멤버 목록 */}
          {(type === 'voice' || type === 'video') &&
            (channelStates?.[type]?.active?.[channel] || channelStates?.[type]?.joined?.[channel]) &&
            expandedChannels.has(channel) && renderChannelMembers(channel)}
        </div>
      ))}

      {/* 컨텍스트 메뉴 */}
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