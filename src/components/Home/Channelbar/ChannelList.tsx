import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import { ChannelType } from './types';
import { useChannels } from './ChannelContext';
import ContextMenu from './ContextMenu';

const GENERAL_VOICE_CHANNEL_ID = "5143992e-9dcd-45fe-bcc7-e337417b0cfe";

const ChannelList: React.FC<{ type: ChannelType; icon: React.ElementType }> = ({ type, icon: Icon }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const {
    channels, addChannel, openSections, toggleSection,
    activeChannels, joinChannel, leaveChannel, currentUser,
    renameChannel, deleteChannel
  } = useChannels();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: string } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 처음 입장 시에만 확장 상태 설정
    if (channelId === GENERAL_VOICE_CHANNEL_ID && type === 'voice') {
      joinChannel(type, '일반');
      setExpandedChannels(new Set(['일반']));
    }
  }, []);  // 빈 의존성 배열로 변경하여 처음 마운트될 때만 실행

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

  const handleChannelClick = async (channelName: string) => {
    if (type === 'voice' || type === 'video') {
      const otherType = type === 'voice' ? 'video' : 'voice';
      const hasActiveOtherChannel = Object.values(activeChannels[otherType]).some(active => active);

      // 현재 활성화된 채널인 경우 접기/펼치기만 수행
      if (activeChannels[type][channelName]) {
        toggleChannelExpand(channelName);
        return;
      }

      if (hasActiveOtherChannel) {
        const confirmSwitch = window.confirm(`현재 ${otherType === 'voice' ? '음성' : '화상'} 채널에 접속 중입니다.\n통화를 종료하고 이동하시겠습니까?`);

        if (confirmSwitch) {
          // 현재 활성화된 채널에서 나가기
          Object.entries(activeChannels[otherType]).forEach(([channel, active]) => {
            if (active) {
              leaveChannel(otherType, channel);
            }
          });

          // 새로운 채널 입장
          if (type === 'voice' && channelName === '일반') {
            await joinChannel(type, channelName);
            navigate(`/voice/${GENERAL_VOICE_CHANNEL_ID}`);
            setExpandedChannels(new Set([channelName]));
          } else {
            joinChannel(type, channelName);
            setExpandedChannels(new Set([channelName]));
          }
        }
        return;
      }

      if (type === 'voice' && channelName === '일반') {
        await joinChannel(type, channelName);
        navigate(`/voice/${GENERAL_VOICE_CHANNEL_ID}`);
        setExpandedChannels(new Set([channelName]));
      } else {
        joinChannel(type, channelName);
        setExpandedChannels(new Set([channelName]));
      }
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

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-gray-400 mb-1 cursor-pointer ml-2"
           onClick={() => toggleSection(type)}>
        <div className="flex items-center">
          <ChevronDown size={12} className={`transform transition-transform ${openSections[type] ? '' : '-rotate-90'}`} />
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
            <Icon size={18} className="mr-[0.9rem]" />
            <span className="flex-grow">{channel}</span>
            {(type === 'voice' || type === 'video') && activeChannels[type][channel] && (
              <div className="mr-[0.9rem]">
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </div>
            )}
          </div>
          {(type === 'voice' || type === 'video') &&
            activeChannels[type][channel] &&
            expandedChannels.has(channel) && (
              <div className="ml-6 mt-1 flex items-center text-gray-400">
                <img
                  src={currentUser.profileImage}
                  alt={currentUser.nickname}
                  className="w-5 h-5 rounded-full mr-[0.9rem]"
                />
                <span className="text-sm font-semibold">{currentUser.nickname}</span>
                <X
                  size={16}
                  className="ml-auto cursor-pointer hover:text-gray-200"
                  onClick={() => leaveChannel(type, channel)}
                />
              </div>
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