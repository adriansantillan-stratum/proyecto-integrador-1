// Cliente OAuth2/OIDC contra Keycloak (Authorization Code + PKCE).
// La URL base y el client_id se configuran por entorno (ver .env.example).

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'ecoroute';
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'web-admin';

const OIDC_BASE = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`;
const PKCE_VERIFIER_KEY = 'pkce_verifier';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function redirectUri(): string {
  return window.location.origin + '/login';
}

/** Inicia el flujo: redirige el navegador a la pantalla de login de Keycloak. */
export async function redirectToKeycloakLogin(): Promise<void> {
  const { verifier, challenge } = await generatePkce();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${OIDC_BASE}/auth?${params.toString()}`;
}

/** Canjea el authorization code (callback de Keycloak) por tokens. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: redirectUri(),
  });
  if (verifier) body.set('code_verifier', verifier);

  const res = await fetch(`${OIDC_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

/** Renueva el access token con el refresh token. Lanza si el refresh expiró. */
export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${OIDC_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

/** Cierra la sesión también en Keycloak (server-side logout). */
export function keycloakLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: window.location.origin + '/login',
  });
  return `${OIDC_BASE}/logout?${params.toString()}`;
}
