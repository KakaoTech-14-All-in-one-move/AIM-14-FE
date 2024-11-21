import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { authApi } from '@/api/auth.api';
import type { LoginRequest, RegisterRequest } from '@/types/auth.types';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const { setServers } = useServerStore();

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      console.log('Login response:', response);

      if (response?.tokenInfo.accessToken && response?.tokenInfo.refreshToken) {
        // 직접 response에서 토큰 값을 가져옴
        setTokens(response.tokenInfo.accessToken, response.tokenInfo.refreshToken);

        // 임시 user 객체 생성 (실제 데이터에 맞게 수정 필요)
        const user = {
          email: response.userInfo.email,
          username: response.userInfo.username, // 또는 적절한 기본값
          profile_image: response.userInfo.profile_image, // 기본 프로필 이미지
          servers: response.userInfo.servers,
        };
        setUser(user);

        // useServerStore에 서버 정보 저장
        setServers(response.userInfo.servers);

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
      await authApi.logout();
      useAuthStore.getState().clearAuth();
      toast.success('로그아웃 되었습니다.');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
