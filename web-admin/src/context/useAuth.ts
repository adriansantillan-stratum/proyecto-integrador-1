import { createContext, useContext } from 'react';
import type { TokenResponse } from '../services/keycloak';
export interface SessionIdentity { subject: string; driverId?: number; roles: (string | { authority: string })[] }
export interface AuthState {
  user: { username: string; subject: string; driverId?: number; roles: string[] } | null;
  token: string | null; login: (tokens: TokenResponse) => void; logout: () => void;
  isAuthenticated: boolean; sessionLoading: boolean; sessionError?: string; retrySession: () => void;
  hasRole: (roles: string[]) => boolean;
}
export const AuthContext = createContext<AuthState | undefined>(undefined);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
