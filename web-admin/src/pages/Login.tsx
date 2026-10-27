import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Loader2, KeyRound } from 'lucide-react';
import { redirectToKeycloakLogin, exchangeCodeForTokens } from '../services/keycloak';

const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [isExchanging, setIsExchanging] = useState(() => new URLSearchParams(window.location.search).has('code'));

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // El authorization code es de un solo uso: el guard evita canjes duplicados
  // (StrictMode y HMR re-ejecutan el efecto).
  const exchangeAttempted = useRef(false);

  // Callback OAuth2: canjear el code por tokens
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !exchangeAttempted.current) {
      exchangeAttempted.current = true;
      exchangeCodeForTokens(code)
        .then((tokens) => {
          login(tokens);
          navigate('/');
        })
        .catch(() => {
          setError('Error al autenticar con el servidor de identidad. Intente de nuevo.');
          setIsExchanging(false);
          window.history.replaceState({}, document.title, '/login');
        });
    }
  }, [searchParams, login, navigate]);

  const handleLogin = () => {
    setError('');
    redirectToKeycloakLogin().catch(() => setError('No se pudo iniciar el proceso de login.'));
  };

  if (isExchanging) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f1f5f9',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <Loader2 className="animate-spin" size={48} color="#2563eb" />
        <p style={{ color: '#64748b' }}>Autenticando...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f1f5f9'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '1rem',
            backgroundColor: '#eff6ff',
            borderRadius: '50%',
            color: '#2563eb',
            marginBottom: '1rem'
          }}>
            <Truck size={32} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>EcoRoute Admin</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Inicia sesión con tu cuenta corporativa
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background-color 0.2s'
          }}
        >
          <KeyRound size={18} />
          Iniciar Sesión
        </button>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          &copy; 2026 Grupo MICOTRANS S.A.C.
        </div>
      </div>
    </div>
  );
};

// Internal icon import for this component
const Truck: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17h4V5H2v12h3m10 0h2l4-4v-5h-9v9m1 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4m10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
  </svg>
);

export default Login;
