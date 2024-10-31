import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';  // 경로는 실제 위치에 맞게 수정

export const OAuth2Callback = () => {
    const navigate = useNavigate();
    const { setTokens, setUser } = useAuthStore();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        if (!accessToken || !refreshToken) {
            navigate('/login', { replace: true });
            return;
        }

        // Zustand store에 토큰 저장
        setTokens(accessToken, refreshToken);

        // 사용자 정보 저장
        const userInfo = {
            email: params.get('email') || '',
            username: params.get('username') || '',
            profile_image: ''  // 필요한 경우 수정
        };

        setUser(userInfo);

        return () => {
            navigate('/home', { replace: true });
        };
    }, [navigate, setTokens, setUser]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-discord900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-kakaoYellow mx-auto"></div>
                <p className="mt-4 text-white">로그인 처리중...</p>
            </div>
        </div>
    );
};