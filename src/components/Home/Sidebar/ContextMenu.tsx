import React from 'react';
import { Divider } from '@/components/Home/Sidebar/Divider';

interface ContextMenuProps {
  x: number;
  y: number;
  onInvite: () => void;
  onRename: () => void;
  onRemove: () => void;
  onImageUpload: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onInvite,
  onRename,
  onRemove,
  onImageUpload
}) => {
  return (
    <div
      className="absolute bg-gray-800 shadow-md rounded-md py-1 z-50"
      style={{
        top: `${y}px`,
        left: `${x}px`,
        minWidth: '120px',
      }}
    >
      <button
        className="block w-full text-left px-4 py-2 text-kakaoYellow hover:bg-gray-700 whitespace-nowrap"
        onClick={onInvite}
      >
        멤버 초대하기
      </button>
      <Divider />
      <button
        className="block w-full text-left px-4 py-2 text-white hover:bg-gray-700 whitespace-nowrap"
        onClick={onImageUpload}
      >
        서버 이미지 변경
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-white hover:bg-gray-700 whitespace-nowrap"
        onClick={onRename}
      >
        서버 이름 변경
      </button>
      <Divider />
      <button
        className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-700 whitespace-nowrap"
        onClick={onRemove}
      >
        서버 삭제
      </button>
    </div>
  );
};