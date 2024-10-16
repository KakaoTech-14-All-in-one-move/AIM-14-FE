import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onRename, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

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
            className="absolute bg-discord900 text-gray-300 rounded shadow-lg z-50 w-48 p-2"
            style={{ top: `${y}px`, left: `${x}px` }}
        >
            <button
                className={`block w-full text-left p-2 rounded-md hover:bg-kakaoYellow hover:text-kakaoBrown
                    ${selectedItem === 'rename' ? 'bg-yellow-500 text-white' : ''}`}
                onClick={onRename}
                onMouseEnter={() => setSelectedItem('rename')}
                onMouseLeave={() => setSelectedItem(null)}
            >
                채널명 변경
            </button>
            <button
                className={`block w-full text-left p-2 rounded-md text-red-500
                    hover:bg-red-500 hover:text-white
                    ${selectedItem === 'delete' ? 'bg-red-500 text-white' : ''}`}
                onClick={onDelete}
                onMouseEnter={() => setSelectedItem('delete')}
                onMouseLeave={() => setSelectedItem(null)}
            >
                채널 삭제하기
            </button>
        </div>
    );
};

export default ContextMenu;