import React, { useState, useRef, useEffect } from 'react';
import { ContextMenu } from '@/components/Home/Sidebar/ContextMenu';

interface SidebarIconProps {
  icon?: React.ReactNode;
  text: string;
  isSelected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  noLeftBar?: boolean;
}

export const SidebarIcon: React.FC<SidebarIconProps> = ({
  icon,
  text,
  isSelected,
  onClick,
  onRemove,
  noLeftBar,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowContextMenu(true);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (iconRef.current && !iconRef.current.contains(event.target as Node)) {
      setShowContextMenu(false);
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
      {!noLeftBar && (
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-gray-300 rounded-r-full
                transition-all duration-300 ease-out
                ${isSelected ? 'h-10' : isHovered ? 'h-5' : 'h-0'}`}
        ></div>
      )}

      <div
        className={`sidebar-icon group flex items-center justify-center w-12 h-12 mx-auto my-2 cursor-pointer 
              ${isSelected || isHovered ? 'rounded-2xl' : 'rounded-full'} 
              transition-colors duration-300`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        {icon}
        <span className="sidebar-tooltip group-hover:scale-100">{text}</span>
      </div>

      {showContextMenu && onRemove && (
        <ContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onRemove={() => {
            onRemove();
            setShowContextMenu(false);
          }}
        />
      )}
    </div>
  );
};
