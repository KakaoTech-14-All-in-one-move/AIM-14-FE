interface UserInfoSectionProps {
    user: any;
    isEditingUsername: boolean;
    isUpdatingUsername: boolean;
    newUsername: string;
    onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onUpdateUsername: () => void;
}

export const UserInfoSection: React.FC<UserInfoSectionProps> = ({
    user,
    isEditingUsername,
    isUpdatingUsername,
    newUsername,
    onUsernameChange,
    onStartEdit,
    onCancelEdit,
    onUpdateUsername
}) => (
    <div className="space-y-4">
        <div>
            <label className="text-xs font-medium text-gray-400">유저 이름</label>
            <div className="flex justify-between items-center mt-1">
                {isEditingUsername ? (
                    <div className="flex items-center gap-2 w-full">
                        <input
                            type="text"
                            value={newUsername}
                            onChange={onUsernameChange}
                            className="bg-[#1e1f22] text-white px-2 py-1 rounded flex-1"
                            placeholder="새로운 사용자 이름"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={onUpdateUsername}
                                disabled={isUpdatingUsername}
                                className="text-xs bg-kakaoYellow text-kakaoBrown px-2 py-1 rounded 
                                         hover:bg-kakaoYellow disabled:opacity-50 transition-colors"
                            >
                                {isUpdatingUsername ? '저장중...' : '저장'}
                            </button>
                            <button
                                onClick={onCancelEdit}
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
                            onClick={onStartEdit}
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
                <div className="text-white">{user.email}</div>
            </div>
        </div>
    </div>
);