import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';

export const OAuth2Callback = () => {
    const navigate = useNavigate();
    const { setTokens, setUser } = useAuthStore();
    const { setServers } = useServerStore();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');
        const serversParam = params.get('servers');

        if (!accessToken || !refreshToken) {
            navigate('/login', { replace: true });
            return;
        }

        // Zustand store에 토큰 저장
        setTokens(accessToken, refreshToken);

        // servers 파라미터가 있으면 파싱
        let servers = [];
        try {
            if (serversParam) {
                servers = JSON.parse(decodeURIComponent(serversParam));
            }
        } catch (error) {
            console.error('Error parsing servers:', error);
        }

        // 사용자 정보에 servers 포함
        const userInfo = {
            email: params.get('email') || '',
            username: params.get('username') || '',
            profile_image: params.get('profile_image') || '',
            servers: servers
        };

        setUser(userInfo);

        // useServerStore에 서버 정보 저장
        setServers(servers);

        // CallProvider가 자동으로 인증 상태를 감지하고 웹소켓 연결을 시작함

        return () => {
            navigate('/home', { replace: true });
        };
    }, [navigate, setTokens, setUser, setServers]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-discord900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-kakaoYellow mx-auto"></div>
                <p className="mt-4 text-white">로그인 처리중...</p>
            </div>
        </div>
    );
};