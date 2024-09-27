import React from 'react';

interface SidebarIconProps {
    icon?: React.ReactNode;
    text: string;
    onClick?: () => void;
}

export const SidebarIcon: React.FC<SidebarIconProps> = ({ icon, text, onClick }) => (
    <div
        className="sidebar-icon group flex items-center justify-center w-10 h-10 rounded-full cursor-pointer"
        onClick={onClick}
    >
        {icon}
        <span className="sidebar-tooltip group-hover:scale-100">
            {text}
        </span>
    </div>
);