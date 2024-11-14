// ChannelList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, HeadphoneOff, MicOff, MonitorUp, Plus, CameraOff } from 'lucide-react';
import { ChannelType } from './types';
import { useChannels } from './ChannelContext';
import { useCall } from '@/services/call/CallProvider';
import ContextMenu from './ContextMenu';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage.tsx';
import { useAuthStore } from '@/stores/authStore.ts';

const GENERAL_VOICE_CHANNEL_ID = '5143992e-9dcd-45fe-bcc7-e337417b0cfe';
const GENERAL_VIDEO_CHANNEL_ID = '6143992e-9dcd-45fe-bcc7-e337417b0cfe';

const ChannelList: React.FC<{ type: ChannelType; icon: React.ElementType }> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const user = useAuthStore(state => state.user);

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
  const { connection } = useCall();
  const voiceChatStore = useVoiceChat();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: string } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const getCurrentChannelId = useCallback(() => {
    return type === 'voice' ? GENERAL_VOICE_CHANNEL_ID : GENERAL_VIDEO_CHANNEL_ID;
  }, [type]);

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

  // 초기 채널 입장 처리
  useEffect(() => {
    const currentChannelId = getCurrentChannelId();

    if (channelId === currentChannelId && (type === 'voice' || type === 'video')) {
      joinChannel(type, '일반');
      setExpandedChannels(new Set(['일반']));
    }
  }, [channelId, type, joinChannel, getCurrentChannelId]);

  // 채널 상태 모니터링
  useEffect(() => {
    if (!['voice', 'video'].includes(type)) return;

    const currentChannelId = getCurrentChannelId();
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
  }, [type, voiceChatStore.users, activateChannel, deactivateChannel, getCurrentChannelId]);

  const renderChannelMembers = useCallback((channelName: string) => {
    if (!['voice', 'video'].includes(type) || channelName !== '일반') {
      return null;
    }

    const currentChannelId = getCurrentChannelId();
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
            {member.profile_image ? (
              <img
                src={import.meta.env.VITE_BE_SERVER_URL + member.profile_image}
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
  }, [type, voiceChatStore.users, getCurrentChannelId]);

  const handleChannelClick = useCallback(async (channelName: string) => {
    if (type !== 'voice' && type !== 'video') return;

    const mediaType = type as Exclude<ChannelType, 'text'>;
    const currentChannelId = getCurrentChannelId();

    // 안전한 channelStates 접근
    const isJoined = channelStates?.[mediaType]?.joined?.[channelName] ?? false;

    if (isJoined) {
      toggleChannelExpand(channelName);
      return;
    }

    const hasActiveOtherChannel = Object.entries(channelStates?.[mediaType]?.joined ?? {})
      .some(([name, joined]) => name !== channelName && joined);

    if (hasActiveOtherChannel) {
      const confirmSwitch = window.confirm(
        `현재 ${mediaType === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`,
      );

      if (!confirmSwitch) return;

      Object.entries(channelStates?.[mediaType]?.joined ?? {}).forEach(([name, joined]) => {
        if (joined) {
          leaveChannel(mediaType, name);
          connection?.leaveChannel();
        }
      });
    }

    if (channelName === '일반') {
      joinChannel(mediaType, channelName);
      connection?.joinChannel(currentChannelId, mediaType.toUpperCase());
      navigate(`/${mediaType}/${currentChannelId}`);
  toggleChannelExpand(channelName);
}
}, [
  type,
  channelStates,
  connection,
  navigate,
  joinChannel,
  leaveChannel,
  toggleChannelExpand,
  getCurrentChannelId
]);

const handleContextMenu = useCallback((e: React.MouseEvent, channel: string) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, channel });
}, []);

const handleRenameChannel = useCallback(() => {
  if (!contextMenu) return;

  const newName = prompt('새 채널 이름을 입력하세요:', contextMenu.channel);
  if (newName && newName !== contextMenu.channel) {
    renameChannel(type, contextMenu.channel, newName);
  }
  setContextMenu(null);
}, [contextMenu, type, renameChannel]);

const handleDeleteChannel = useCallback(() => {
  if (!contextMenu) return;

  if (window.confirm(`정말로 '${contextMenu.channel}' 채널을 삭제하시겠습니까?`)) {
    deleteChannel(type, contextMenu.channel);
  }
  setContextMenu(null);
}, [contextMenu, type, deleteChannel]);

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