import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthEventHandler } from '@/components/Router/AuthEventHandler';
import { AppRoutes } from '@/components/Router/AppRoutes';
import { ToastProvider } from '@/components/Provider/ToastProvider';
import { CallProvider } from '@/services/call/CallProvider';
import { ChannelNavigationProvider } from '@/components/Provider/ChannelNavigationProvider.tsx';

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <CallProvider>
          <ChannelNavigationProvider>
            <AuthEventHandler />
            <AppRoutes />
          </ChannelNavigationProvider>
        </CallProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;