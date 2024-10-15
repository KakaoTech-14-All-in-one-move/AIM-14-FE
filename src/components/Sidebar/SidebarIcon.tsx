import React, { useState, useRef, useEffect } from 'react';
import { ContextMenu } from './ContextMenu';

interface SidebarIconProps {
    icon?: React.ReactNode;
    text: string;
    onClick?: () => void;
    onRemove?: () => void;
}

export const SidebarIcon: React.FC<SidebarIconProps> = ({ icon, text, onClick, onRemove }) => {
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
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
        <div ref={iconRef}>
            <div
                className="sidebar-icon group flex items-center justify-center w-10 h-10 rounded-full cursor-pointer"
                onClick={onClick}
                onContextMenu={handleContextMenu}
            >
                {icon}
                <span className="sidebar-tooltip group-hover:scale-100">
                    {text}
                </span>
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