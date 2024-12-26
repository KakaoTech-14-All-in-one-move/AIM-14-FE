import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from '@/components/Home';
import Login from '@/components/Login';
import { ProtectedRoute } from '@/components/Router/ProtectedRoute';
import { PublicRoute } from '@/components/Router/PublicRoute';
import { AuthEventHandler } from '@/components/Router/AuthEventHandler';
import { OAuth2Callback } from '@/components/Login/OAuth2Callback';
import Record from '@/components/Record';
import Voice from '@/components/Voice';
import Video from '@/components/Video';
import Feedback from '@/components/feedback';
import Health from '@/api/Health.tsx';

export const AppRoutes: React.FC = () => {
  const isAuthenticated = () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return !!(accessToken && refreshToken);
  };

  return (
    <div className="min-h-screen bg-discord900">
      <AuthEventHandler />
      <Routes>
        <Route
          path="/health"
          element={<Health />}
        />
        <Route
          path="/login"
          element={
            isAuthenticated() ? (
              <Navigate to="/home" replace />
            ) : (
              <PublicRoute>
                <Login />
              </PublicRoute>
            )
          }
        />
        <Route
          path="/oauth2/callback"
          element={
            <PublicRoute>
              <OAuth2Callback />
            </PublicRoute>
          }
        />
        <Route
          path="/channels/:serverId"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:serverId/:channelId"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/record"
          element={
            <ProtectedRoute>
              <Record />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback"
          element={
            <ProtectedRoute>
              <Feedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/voice/:channelId"
          element={
            <ProtectedRoute>
              <Voice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/video/:channelId"
          element={
            <ProtectedRoute>
              <Video />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
};