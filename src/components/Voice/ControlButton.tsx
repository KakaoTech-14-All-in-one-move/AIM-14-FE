// src/components/Voice/ControlButton.tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ControlButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  className?: string;
}

export const ControlButton: React.FC<ControlButtonProps> = ({
                                                              icon: Icon,
                                                              onClick,
                                                              tooltip,
                                                              active,
                                                              className = 'bg-gray-700 hover:bg-gray-600'
                                                            }) => {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-full flex items-center justify-center group relative ${className}`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-red-500' : 'text-white'}`} />
      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100">
        {tooltip}
      </span>
    </button>
  );
};