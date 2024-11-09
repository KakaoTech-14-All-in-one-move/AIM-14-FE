interface LogoutSectionProps {
    onLogout: () => void;
}

export const LogoutSection: React.FC<LogoutSectionProps> = ({ onLogout }) => (
    <div className="p-4 bg-discord600 rounded-lg mx-4 mb-4">
        <h3 className="text-white text-lg font-semibold mb-2">로그아웃</h3>
        <p className="text-gray-400 text-sm mb-4">
            다른 계정으로 로그인하시겠습니까?
        </p>
        <button
            onClick={onLogout}
            className="px-4 py-2 border border-gray-500 text-gray-300 rounded-md 
                     hover:bg-gray-500/10 transition-colors"
        >
            로그아웃
        </button>
    </div>
);