import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/apiClient';
import { ProfileSection } from '@/components/UserSettings/ProfileSection';
import { UserInfoSection } from '@/components/UserSettings/UserInfoSection';
import { LogoutSection } from '@/components/UserSettings/LogoutSection';
import { DeleteAccountSection } from '@/components/UserSettings/DeleteAccountSection';

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setProfileImage = useAuthStore(state => state.setProfileImage);
    const clearAuth = useAuthStore(state => state.clearAuth);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen || !user) return null;

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('파일 크기는 2MB 이하여야 합니다.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const response = await apiClient.client.post('/api/v1/users/profile-image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.status !== 200) {
                throw new Error('프로필 이미지 업로드에 실패했습니다.');
            }

            const { profileImageUrl } = response.data;
            setProfileImage(profileImageUrl);

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || '이미지 업로드에 실패했습니다.';
            alert(errorMessage);
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartEditUsername = () => {
        setIsEditingUsername(true);
        setNewUsername(user.username);
    };

    const handleCancelEditUsername = () => {
        setIsEditingUsername(false);
        setNewUsername('');
    };

    const handleUpdateUsername = async () => {
        if (!newUsername.trim() || newUsername === user.username) {
            handleCancelEditUsername();
            return;
        }

        try {
            setIsUpdatingUsername(true);
            const response = await apiClient.client.put('/api/v1/users/username', {
                username: newUsername
            });

            if (response.status === 200) {
                setUser({
                    ...user,
                    username: newUsername
                });
                setIsEditingUsername(false);
            } else {
                throw new Error('사용자 이름 업데이트에 실패했습니다.');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || '사용자 이름 업데이트에 실패했습니다.';
            alert(errorMessage);
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            setIsDeleting(true);
            await apiClient.client.delete('/api/v1/users/me');

            clearAuth();
            onClose();
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || '계정 삭제에 실패했습니다. 다시 시도해주세요.';
            alert(errorMessage);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLogout = async () => {
        if (!window.confirm('로그아웃 하시겠습니까?')) {
            return;
        }

        try {
            clearAuth();
            onClose();
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-discord800 bg-opacity-80 flex items-center justify-center z-50">
            <div className="w-full max-w-[650px] bg-discord800 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center p-4">
                    <h1 className="text-white text-xl font-bold">내 계정</h1>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 bg-discord600 rounded-lg mx-4 mb-4">
                    <ProfileSection
                        user={user}
                        isUploading={isUploading}
                        fileInputRef={fileInputRef}
                        onImageClick={handleImageClick}
                        onImageChange={handleImageChange}
                    />
                    <UserInfoSection
                        user={user}
                        isEditingUsername={isEditingUsername}
                        isUpdatingUsername={isUpdatingUsername}
                        newUsername={newUsername}
                        onUsernameChange={(e) => setNewUsername(e.target.value)}
                        onStartEdit={handleStartEditUsername}
                        onCancelEdit={handleCancelEditUsername}
                        onUpdateUsername={handleUpdateUsername}
                    />
                </div>

                <LogoutSection onLogout={handleLogout} />
                <DeleteAccountSection
                    onDelete={handleDeleteAccount}
                    isDeleting={isDeleting}
                />
            </div>
        </div>
    );
};

export default UserSettingsModal;