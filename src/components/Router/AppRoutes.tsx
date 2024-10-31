import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '@/components/Home';
import Login from '@/components/Login';
import { ProtectedRoute } from '@/components/router/ProtectedRoute';
import { PublicRoute } from '@/components/router/PublicRoute';
import { AuthEventHandler } from '@/components/router/AuthEventHandler';
import { OAuth2Callback } from '@/components/login/OAuth2Callback';

export const AppRoutes: React.FC = () => {
    // 전역적으로 인증 상태 체크
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
                    path="/home"
                    element={
                        <ProtectedRoute>
                            <Home />
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