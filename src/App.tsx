import React from 'react';
<<<<<<< HEAD
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthEventHandler } from '@/components/Router/AuthEventHandler';
import { AppRoutes } from '@/components/Router/AppRoutes';
import { ToastProvider } from '@/components/Provider/ToastProvider';
=======
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from '../src/components/Home';
import Login from '../src/components/Login';
import Index from './components/record';
import { useStore } from './stores/login';
>>>>>>> 3a29a03 (feat: Add RecordingPage Route)

const App: React.FC = () => {
  return (
    <Router>
<<<<<<< HEAD
      <ToastProvider>
        <AuthEventHandler />
        <AppRoutes />
      </ToastProvider>
=======
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/login" element={isLoggedIn ? <Navigate to="/home" /> : <Login />} />
          <Route path="/home" element={isLoggedIn ? <Home /> : <Navigate to="/login" />} />
          {/*<Route path="/feedback" element={isLoggedIn ? <Index /> : <Navigate to="/login" />} />*/}
          <Route path="/feedback" element={<Index />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
>>>>>>> 3a29a03 (feat: Add RecordingPage Route)
    </Router>
  );
};

export default App;