import { useCallback, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { keycloakLogoutUrl } from '../services/keycloak';
import type { TokenResponse } from '../services/keycloak';
import { AuthContext } from './useAuth';
import type { SessionIdentity } from './useAuth';
import { useQuery } from '../hooks/useQuery';
import { updateVerifiedSession } from './verifiedSession';
import type { VerifiedSession } from './verifiedSession';

function subscribe(change: () => void) {
  window.addEventListener('storage', change); window.addEventListener('ecoroute:auth', change);
  return () => { window.removeEventListener('storage', change); window.removeEventListener('ecoroute:auth', change); };
}
function currentToken() { return localStorage.getItem('token'); }
export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, currentToken, () => null);
  let username = '';
  let subject: string | null = null;
  try { if (token) { const decoded = jwtDecode<{ sub: string; preferred_username?: string }>(token); if (typeof decoded.sub === 'string' && decoded.sub) { subject = decoded.sub; username = decoded.preferred_username ?? decoded.sub; } } } catch { /* Invalid token yields unauthenticated state. */ }
  const valid = !!subject;
  const session = useQuery<SessionIdentity>(valid ? '/session/me' : null, token ?? '');
  const [verified, setVerified] = useState<VerifiedSession>({ subject: null });
  const current = updateVerifiedSession(verified, subject, session);
  // Adjust before rendering children so a subject change/error cannot reuse an
  // earlier identity, including an A -> B -> A switch during pending requests.
  if (current !== verified) setVerified(current);
  const sessionError = session.error || (session.data && session.data.subject !== subject ? 'La identidad del servidor no corresponde a la sesión actual.' : undefined);
  const identity = current.identity;
  const roles = (identity?.roles ?? []).map(role => (typeof role === 'string' ? role : role.authority).replace(/^ROLE_/, '')).filter(role => ['ADMIN', 'DISPATCHER', 'DRIVER'].includes(role));
  const user = identity ? { username, subject: identity.subject, driverId: identity.driverId, roles } : null;
  const login = useCallback((tokens: TokenResponse) => {
    localStorage.setItem('token', tokens.access_token); localStorage.setItem('refresh_token', tokens.refresh_token);
    window.dispatchEvent(new Event('ecoroute:auth'));
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem('token'); localStorage.removeItem('refresh_token');
    window.dispatchEvent(new Event('ecoroute:auth')); window.location.href = keycloakLogoutUrl();
  }, []);
  return <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: valid, sessionLoading: session.loading && !identity, sessionError, retrySession: session.reload, hasRole: requested => roles.some(role => requested.includes(role)) }}>{children}</AuthContext.Provider>;
}
