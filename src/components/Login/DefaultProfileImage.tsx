import React from 'react';

interface DefaultProfileImageProps {
    username?: string;
    size?: number;
}

export const generateProfileImageUrl = (username: string = '', size: number = 40): string => {
    const initial = username ? username.charAt(0).toUpperCase() : '?';

    const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        text-anchor="middle"
        fill="#000000"
        font-family="Arial"
        font-size="${size * 0.6}px"
        font-weight="bold"
      >${initial}</text>
    </svg>
  `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const DefaultProfileImage: React.FC<DefaultProfileImageProps> = ({
    username = '',
    size = 40
}) => {
    return (
        <img
            src={generateProfileImageUrl(username, size)}
            alt={username || '?'}
            className="rounded-full"
            width={size}
            height={size}
        />
    );
};