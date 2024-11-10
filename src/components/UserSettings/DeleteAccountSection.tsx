interface DeleteAccountSectionProps {
    onDelete: () => void;
    isDeleting: boolean;
}

export const DeleteAccountSection: React.FC<DeleteAccountSectionProps> = ({
    onDelete,
    isDeleting
}) => (
    <div className="p-4 bg-discord600 rounded-lg mx-4 mb-4">
        <h3 className="text-white text-lg font-semibold mb-2">계정 제거</h3>
        <p className="text-gray-400 text-sm mb-4">
            삭제된 계정은 복구할 수 없으며, 모든 데이터가 즉시 삭제됩니다.
        </p>
        <div className="flex gap-3">
            <button
                onClick={onDelete}
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
);