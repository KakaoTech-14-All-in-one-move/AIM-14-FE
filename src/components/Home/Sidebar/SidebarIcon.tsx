import React, { useState, useRef, useEffect } from 'react';
import { ContextMenu } from '@/components/Home/Sidebar/ContextMenu';

interface SidebarIconProps {
  icon?: React.ReactNode;
  text: string;
  serverId?: number;
  isSelected?: boolean;
  onClick?: () => void;
  onRename?: (newName: string) => void;
  onRemove?: () => void;
  onImageUpload?: (file: File) => void;
  onInvite?: () => void;
  noLeftBar?: boolean;
  hasServerImage?: boolean;
}

let activeContextMenu: (() => void) | null = null;

export const SidebarIcon: React.FC<SidebarIconProps> = ({
  icon,
  text,
  serverId,
  isSelected,
  onClick,
  onRename,
  onRemove,
  onImageUpload,
  onInvite,
  noLeftBar,
  hasServerImage,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeContextMenu = () => {
    setShowContextMenu(false);
  };

  useEffect(() => {
    return () => {
      if (activeContextMenu === closeContextMenu) {
        activeContextMenu = null;
      }
    };
  }, []);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();

    if (activeContextMenu && activeContextMenu !== closeContextMenu) {
      activeContextMenu();
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const menuWidth = 120;
    const menuHeight = 100;

    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > screenW) {
      x = screenW - menuWidth - 10;
    }
    if (y + menuHeight > screenH) {
      y = screenH - menuHeight - 10;
    }

    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
    activeContextMenu = closeContextMenu;
  };

  const handleRename = () => {
    const newName = prompt('새로운 서버 이름을 입력하세요:', text);
    if (newName && newName.trim() && onRename) {
      onRename(newName.trim());
    }
    closeContextMenu();
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
    closeContextMenu();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (iconRef.current && !iconRef.current.contains(event.target as Node)) {
      closeContextMenu();
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={iconRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {!noLeftBar && (
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-gray-300 rounded-r-full
                transition-all duration-150 ease-in
                ${isSelected ? 'h-10' : isHovered ? 'h-5' : 'h-0'}`}
        ></div>
      )}

      <div
        className={`sidebar-icon group flex items-center justify-center w-12 h-12 mx-auto my-2 cursor-pointer hover:bg-discord700 
              ${isSelected ? 'bg-discord700' : ''} 
              ${isSelected || isHovered ? 'rounded-2xl' : 'rounded-full'} 
              transition-all duration-150 ease-in`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <div className={`w-full h-full flex items-center justify-center ${hasServerImage ? (isSelected || isHovered ? 'rounded-2xl' : 'rounded-full') : ''} transition-all duration-150 ease-in overflow-hidden`}>
          {hasServerImage ? (
            icon
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              {icon}
            </div>
          )}
        </div>
        <span className="sidebar-tooltip group-hover:scale-100 transition-transform duration-150 ease-in">{text}</span>
      </div>

      {showContextMenu && onRemove && (
        <div className="fixed z-50" style={{
          left: contextMenuPosition.x,
          top: contextMenuPosition.y
        }}>
          <ContextMenu
            x={0}
            y={0}
            onInvite={() => {
              closeContextMenu();
              onInvite?.();
            }}
            onRename={handleRename}
            onRemove={() => {
              onRemove();
              closeContextMenu();
            }}
            onImageUpload={handleImageUpload}
          />
        </div>
      )}
    </div>
  );
};