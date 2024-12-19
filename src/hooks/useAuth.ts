import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import useWebSocketStore from '@/stores/webSocketStore';
import { authApi } from '@/api/auth.api';
import { Server } from '@/types/server';
import type { LoginRequest, RegisterRequest } from '@/types/auth.types';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const { setServers } = useServerStore();
  const connectWebSocket = useWebSocketStore((state) => state.connect);

  const connectToAllChatChannels = useCallback(
    (servers: Server[]) => {
      console.log('Connecting to all chat channels:', servers);
      servers.forEach((server) => {
        server.channels?.forEach((channel) => {
          if (channel.channelCategory === 'CHAT') {
            console.log(`Connecting to chat channel: ${channel.channelId}`);
            connectWebSocket(channel.channelId.toString());
          }
        });
      });
    },
    [connectWebSocket],
  );

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      console.log('Login response:', response);

      if (response?.tokenInfo.accessToken && response?.tokenInfo.refreshToken) {
        setTokens(response.tokenInfo.accessToken, response.tokenInfo.refreshToken);

        const user = {
          email: response.userInfo.email,
          username: response.userInfo.username,
          user_id: response.userInfo.user_id,
          profile_image: response.userInfo.profile_image,
          servers: response.userInfo.servers,
        };
        setUser(user);
        setServers(response.userInfo.servers);

        console.log('Initiating WebSocket connections');
        connectToAllChatChannels(response.userInfo.servers);

        toast.success('로그인 되었습니다.');
        navigate('/home');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      toast.success('회원가입이 완료되었습니다. 로그인해주세요.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '회원가입에 실패했습니다.';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkEmail = async (email: string): Promise<boolean> => {
    try {
      const response = await authApi.checkEmail(email);
      return response.data.exists;
    } catch (error) {
      console.error('Email check failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      const cleanup = () => {
        // WebSocket 연결 해제
        useWebSocketStore.getState().disconnect();
        // 로컬 스토리지 정리
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Auth 상태 초기화
        useAuthStore.getState().clearAuth();
        // Servers 상태 초기화
        useServerStore.getState().setServers([]);
        // 페이지 강제 이동
        window.location.href = '/login';
      };

      cleanup();
      toast.success('로그아웃 되었습니다.');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  return {
    isLoading,
    login,
    register,
    checkEmail,
    logout,
  };
};
