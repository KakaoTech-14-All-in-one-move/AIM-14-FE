import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ControlButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

// ControlButton.tsx
export const ControlButton: React.FC<ControlButtonProps> = ({
                                                              icon: Icon,
                                                              onClick,
                                                              tooltip,
                                                              active = false,
                                                              disabled = false,
                                                              className = ''
                                                            }) => {
  const defaultClass = active
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-gray-700 hover:bg-gray-600';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-12 h-12 rounded-full flex items-center justify-center group relative transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className || defaultClass}`}
    >
      <Icon className={`w-5 h-5 text-white`} />
      <span
        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs
          py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200
          whitespace-nowrap z-50"
      >
        {tooltip}
      </span>
    </button>
  );
};