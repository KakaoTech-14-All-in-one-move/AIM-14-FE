import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onRename, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="absolute bg-discord900 text-kakaoYellow rounded shadow-lg py-1 z-50"
            style={{ top: `${y}px`, left: `${x}px` }}
        >
            <button
                className="block w-full text-left px-4 py-2 hover:bg-discord700"
                onClick={onRename}
            >
                채널명 변경
            </button>
            <button
                className="block w-full text-left px-4 py-2 hover:bg-discord700 text-red-500"
                onClick={onDelete}
            >
                채널 삭제하기
            </button>
        </div>
    );
};

export default ContextMenu;