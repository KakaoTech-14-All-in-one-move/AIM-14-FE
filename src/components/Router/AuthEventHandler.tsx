import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export const AuthEventHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLoginRequired = () => {
      toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
      navigate('/login');
    };

    const handleAuthError = (event: CustomEvent<{ message: string }>) => {
      toast.error(event.detail.message);
    };

    window.addEventListener('auth:loginRequired', handleLoginRequired);
    window.addEventListener('auth:error', handleAuthError as EventListener);

    return () => {
      window.removeEventListener('auth:loginRequired', handleLoginRequired);
      window.removeEventListener('auth:error', handleAuthError as EventListener);
    };
  }, [navigate]);

  return null;
};