// src/components/OAuth2Callback.tsx
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import useWebSocketStore from '@/stores/webSocketStore';
import { Server } from '@/types/server';

export const OAuth2Callback = () => {
    const navigate = useNavigate();
    const { setTokens, setUser } = useAuthStore();
    const { setServers } = useServerStore();
    const connectWebSocket = useWebSocketStore(state => state.connect);

    const connectToAllChatChannels = useCallback((servers: Server[]) => {
        servers.forEach(server => {
            server.channels?.forEach(channel => {
                if (channel.channelCategory === 'CHAT') {
                    console.log(`Connecting to chat channel: ${channel.channelId}`);
                    connectWebSocket(channel.channelId.toString());
                }
            });
        });
    }, [connectWebSocket]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');
        const serversParam = params.get('servers');

        if (!accessToken || !refreshToken) {
            navigate('/login', { replace: true });
            return;
        }

        setTokens(accessToken, refreshToken);

        let servers = [];
        try {
            if (serversParam) {
                servers = JSON.parse(decodeURIComponent(serversParam));
            }
        } catch (error) {
            console.error('Error parsing servers:', error);
        }

        const userInfo = {
            email: params.get('email') || '',
            username: params.get('username') || '',
            user_id: parseInt(params.get('user_id') || '0'),
            profile_image: params.get('profile_image') || '',
            servers: servers
        };

        setUser(userInfo);
        setServers(servers);

        // 모든 채팅 채널에 WebSocket 연결
        connectToAllChatChannels(servers);

        navigate('/home', { replace: true });
    }, [navigate, setTokens, setUser, setServers, connectToAllChatChannels]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-discord900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-kakaoYellow mx-auto"></div>
                <p className="mt-4 text-white">로그인 처리중...</p>
            </div>
        </div>
    );
};