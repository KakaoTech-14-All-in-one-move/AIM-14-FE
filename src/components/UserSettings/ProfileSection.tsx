import React from 'react';
import { Upload } from 'lucide-react';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';

const BASE_URL = import.meta.env.VITE_BE_SERVER_URL

interface ProfileSectionProps {
    user: any;
    isUploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onImageClick: () => void;
    onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
    user,
    isUploading,
    fileInputRef,
    onImageClick,
    onImageChange
}) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
            {user.profile_image ? (
                <img
                    src={BASE_URL + user.profile_image}
                    alt={user.username}
                    className="w-16 h-16 rounded-full object-cover"
                />
            ) : (
                <DefaultProfileImage username={user.username} size={64} />
            )}
            <div className="text-white text-lg font-semibold">{user.username}</div>
        </div>
        <div className="flex items-center">
            <input
                type="file"
                ref={fileInputRef}
                onChange={onImageChange}
                accept="image/*"
                className="hidden"
            />
            <button
                onClick={onImageClick}
                disabled={isUploading}
                className="px-4 py-2 font-bold bg-kakaoYellow text-kakaoBrown rounded-md hover:bg-kakaoYellow/90 
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
                {isUploading ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-kakaoBrown"></div>
                        업로드중...
                    </>
                ) : (
                    <>
                        <Upload size={16} />
                        프로필 이미지 변경
                    </>
                )}
            </button>
        </div>
    </div>
);