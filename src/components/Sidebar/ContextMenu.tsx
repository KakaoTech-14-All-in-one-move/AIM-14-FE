import React from 'react';
import { Divider } from './Divider';

interface ContextMenuProps {
    x: number;
    y: number;
    onInvite: () => void;
    onRemove: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onInvite, onRemove }) => {
    return (
        <div
            className="absolute bg-black shadow-md rounded-md py-1 z-50"
            style={{
                top: `${y}px`,
                left: `${x}px`,
                minWidth: '120px'
            }}
        >
            {/* TODO: 멤버 초대 기능 (멤버 초대하는 UI, DB 조회하여 초대) */}
            <button
                className="block w-full text-left px-4 py-2 text-kakaoYellow hover:bg-gray-800 whitespace-nowrap"
                onClick={onInvite}
            >
                멤버 초대하기
            </button>
            <Divider />
            {/* TODO: 서버를 만든 관리자라면 채널, 카테고리를 관리할 수 있는 버튼 활성화 */}
            <button
                className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-800 whitespace-nowrap"
                onClick={onRemove}
            >
                서버 삭제
            </button>
        </div>
    );
};