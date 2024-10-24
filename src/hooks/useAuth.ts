import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authService } from '@/services/auth.service';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(data);
      toast.success('로그인 되었습니다.');
      navigate('/home');
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.register(data);
      toast.success('회원가입이 완료되었습니다. 로그인해주세요.');
      navigate('/login');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const checkEmail = async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      return await authService.checkEmail(email);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '이메일 확인 중 오류가 발생했습니다';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    toast.success('로그아웃 되었습니다.');
    navigate('/login');
  };

  return {
    isLoading,
    error,
    login,
    register,
    checkEmail,
    logout,
    isAuthenticated: authService.isAuthenticated,
  };
};
