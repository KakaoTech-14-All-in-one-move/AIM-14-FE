import React from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onRemove: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onRemove }) => {
    return (
        <div
            className="absolute bg-black shadow-md rounded-md py-1 z-50"
            style={{
                top: `${y}px`,
                left: `${x}px`,
                minWidth: '120px'
            }}
        >
            <button
                className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-800 whitespace-nowrap"
                onClick={onRemove}
            >
                서버 삭제
            </button>
        </div>
    );
};