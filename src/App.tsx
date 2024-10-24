import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthEventHandler } from '@/components/Router/AuthEventHandler';
import { AppRoutes } from '@/components/Router/AppRoutes';
import { ToastProvider } from '@/components/Provider/ToastProvider';

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <AuthEventHandler />
        <div className="min-h-screen bg-discord900">
          <AppRoutes />
        </div>
      </ToastProvider>
    </Router>
  );
};

export default App;