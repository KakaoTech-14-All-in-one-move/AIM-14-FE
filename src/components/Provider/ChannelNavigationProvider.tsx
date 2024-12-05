import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelNavigator } from './ChannelNavigator';

export const ChannelNavigationProvider: React.FC<{ children: React.ReactNode }> = ({
                                                                                     children
                                                                                   }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // 네비게이션 함수 설정
    ChannelNavigator.getInstance().setNavigate(navigate);

    return () => {
      ChannelNavigator.getInstance().dispose();
    };
  }, [navigate]);

  return <>{children}</>;
};