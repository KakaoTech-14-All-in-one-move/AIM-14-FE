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

// 현재 열린 컨텍스트 메뉴를 관리하는 전역 변수
let activeContextMenu: (() => void) | null = null;

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

  // 컨텍스트 메뉴를 닫는 함수
  const closeContextMenu = () => {
    setShowContextMenu(false);
  };

  // 컴포넌트가 마운트될 때 closeContextMenu 함수를 등록
  useEffect(() => {
    return () => {
      if (activeContextMenu === closeContextMenu) {
        activeContextMenu = null;
      }
    };
  }, []);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();

    // 이전에 열린 컨텍스트 메뉴가 있다면 닫기
    if (activeContextMenu && activeContextMenu !== closeContextMenu) {
      activeContextMenu();
    }

    // 화면 크기 가져오기
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // contextMenu의 예상 크기
    const menuWidth = 120;
    const menuHeight = 100;

    // 마우스 위치
    let x = event.clientX;
    let y = event.clientY;

    // 화면 경계 체크
    if (x + menuWidth > screenW) {
      x = screenW - menuWidth - 10;
    }
    if (y + menuHeight > screenH) {
      y = screenH - menuHeight - 10;
    }

    setContextMenuPosition({ x, y });
    setShowContextMenu(true);

    // 현재 컨텍스트 메뉴의 닫기 함수를 activeContextMenu에 저장
    activeContextMenu = closeContextMenu;
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
      {!noLeftBar && (
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-gray-300 rounded-r-full
                transition-all duration-300 ease-out
                ${isSelected ? 'h-10' : isHovered ? 'h-5' : 'h-0'}`}
        ></div>
      )}

      <div
        className={`sidebar-icon group flex items-center justify-center w-12 h-12 mx-auto my-2 cursor-pointer hover:bg-discord700 
              ${isSelected || isHovered ? 'rounded-2xl' : 'rounded-full'} 
              transition-colors duration-300`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        {icon}
        <span className="sidebar-tooltip group-hover:scale-100">{text}</span>
      </div>

      {showContextMenu && onRemove && (
        <div className="fixed z-50" style={{
          left: contextMenuPosition.x,
          top: contextMenuPosition.y
        }}>
          <ContextMenu
            x={0}
            y={0}
            onRemove={() => {
              onRemove();
              closeContextMenu();
            }}
            onInvite={() => {
              // 초대 로직
              closeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
};