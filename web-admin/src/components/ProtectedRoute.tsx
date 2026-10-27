import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { SourceState } from './Operations';

interface ProtectedRouteProps {
  roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ roles }) => {
  const { isAuthenticated, user, sessionLoading, sessionError, retrySession } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (sessionLoading || sessionError) return <main className="main-content"><SourceState loading={sessionLoading} error={sessionError} retry={retrySession} /></main>;
  if (roles) {
    const hasRole = roles.some(role => user?.roles.includes(role));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
