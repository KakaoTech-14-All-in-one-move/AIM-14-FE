import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '@/components/Home';
import Login from '@/components/Login';
import { ProtectedRoute } from '@/components/router/ProtectedRoute';
import { PublicRoute } from '@/components/router/PublicRoute';
import { AuthEventHandler } from '@/components/router/AuthEventHandler';

export const AppRoutes: React.FC = () => {
    return (
        <div className="min-h-screen bg-discord900">
            <AuthEventHandler />
            <Routes>
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
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
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </div>
    );
};