import React, { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { ChannelType } from '@/components/Home/Channelbar/types';
import { useChannels } from '@/components/Home/Channelbar/ChannelContext';
import ContextMenu from '@/components/Home/Channelbar/ContextMenu';

const ChannelList: React.FC<{ type: ChannelType; icon: React.ElementType }> = ({ type, icon: Icon }) => {
    const {
        channels, addChannel, openSections, toggleSection,
        activeChannels, joinChannel, leaveChannel, currentUser,
        renameChannel, deleteChannel
    } = useChannels();
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channel: string } | null>(null);

    const handleChannelClick = (channelName: string) => {
        if (type === 'voice' || type === 'video') {
            if (activeChannels[type][channelName]) {
                leaveChannel(type, channelName);
            } else {
                joinChannel(type, channelName);
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
            <div className="flex items-center justify-between text-gray-400 mb-1 cursor-pointer ml-2" onClick={() => toggleSection(type)}>
                <div className="flex items-center">
                    <ChevronDown size={12} className={`mr-1 transform transition-transform ${openSections[type] ? '' : '-rotate-90'}`} />
                    <span className="uppercase text-xs font-semibold">{type === 'text' ? '채팅' : type === 'voice' ? '음성' : '화상'} 채널</span>
                </div>
                <Plus size={13} className="hover:text-gray-200 mr-5 stroke-2" style={{ strokeWidth: 3 }} onClick={(e) => { e.stopPropagation(); addChannel(type, `New ${type} channel`); }} />
            </div>
            {openSections[type] && channels[type].map((channel: string) => (
                <div key={channel} className="mb-1 ml-3">
                    <div
                        className={`flex items-center text-gray-400 hover:bg-gray-700 hover:text-gray-200 px-2 py-1 rounded cursor-pointer ${type !== 'text' && activeChannels[type][channel] ? 'bg-gray-700 text-white' : ''}`}
                        onClick={() => handleChannelClick(channel)}
                        onContextMenu={(e) => handleContextMenu(e, channel)}
                    >
                        <Icon size={18} className="mr-2" />
                        {channel}
                    </div>
                    {(type === 'voice' || type === 'video') && activeChannels[type][channel] && (
                        <div className="ml-6 mt-1 flex items-center text-gray-400">
                            <img src={currentUser.profileImage} alt={currentUser.nickname} className="w-5 h-5 rounded-full mr-2" />
                            <span className="text-sm font-semibold">{currentUser.nickname}</span>
                            <X size={16} className="ml-auto cursor-pointer hover:text-gray-200" onClick={() => leaveChannel(type, channel)} />
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