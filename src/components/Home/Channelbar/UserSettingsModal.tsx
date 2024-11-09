import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DefaultProfileImage } from '@/components/Login/DefaultProfileImage';
import { apiClient } from '@/api/apiClient';

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

        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('이미지 업로드에 실패했습니다.');
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
                // Update local user state with new username
                setUser({
                    ...user,
                    username: newUsername
                });
                setIsEditingUsername(false);
            } else {
                throw new Error('사용자 이름 업데이트에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to update username:', error);
            alert('사용자 이름 업데이트에 실패했습니다.');
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

            clearAuth();  // 로그아웃 처리
            onClose();    // 모달 닫기

            // 필요한 경우 메인 페이지로 리다이렉트
            window.location.href = '/login';
        } catch (error) {
            console.error('Failed to delete account:', error);
            alert('계정 삭제에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLogout = async () => {
        if (!window.confirm('로그아웃 하시겠습니까?')) {
            return;
        }

        try {
            clearAuth();  // 로그아웃 처리
            onClose();    // 모달 닫기
            window.location.href = '/login';
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="w-full max-w-[650px] bg-[#2b2d31] rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4">
                    <h1 className="text-white text-xl font-bold">내 계정</h1>
                    <div className="flex items-center">
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Profile section */}
                <div className="p-4 bg-[#313338] rounded-lg mx-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            {user.profile_image ? (
                                <img
                                    src={user.profile_image}
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
                                onChange={handleImageChange}
                                accept="image/*"
                                className="hidden"
                            />
                            <button
                                onClick={handleImageClick}
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

                    {/* User Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-400">별명</label>
                            <div className="flex justify-between items-center mt-1">
                                {isEditingUsername ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <input
                                            type="text"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            className="bg-[#1e1f22] text-white px-2 py-1 rounded flex-1"
                                            placeholder="새로운 사용자 이름"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateUsername}
                                                disabled={isUpdatingUsername}
                                                className="text-xs bg-kakaoYellow text-kakaoBrown px-2 py-1 rounded 
                                                         hover:bg-kakaoYellow/90 disabled:opacity-50 transition-colors"
                                            >
                                                {isUpdatingUsername ? '저장중...' : '저장'}
                                            </button>
                                            <button
                                                onClick={handleCancelEditUsername}
                                                disabled={isUpdatingUsername}
                                                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-white">{user.username}</span>
                                        <button
                                            onClick={handleStartEditUsername}
                                            className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
                                        >
                                            수정
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-400">이메일</label>
                            <div className="flex justify-between items-center mt-1">
                                <div className="text-white">
                                    {user.email}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                {/* Account Deletion */}
                <div className="p-4 bg-[#313338] rounded-lg mx-4 mb-4">
                    <h3 className="text-white text-lg font-semibold mb-2">계정 제거</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        삭제된 계정은 복구할 수 없으며, 모든 데이터가 즉시 삭제됩니다.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="px-4 py-2 border border-red-500 text-red-500 rounded-md 
                             hover:bg-red-500/10 transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDeleting ? (
                                <span className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                    삭제중...
                                </span>
                            ) : (
                                "계정 삭제하기"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserSettingsModal;