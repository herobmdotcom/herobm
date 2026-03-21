'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { login, getToken, getRole, validateSession, reportError } from '../../lib/api';

const AuthContext = createContext<{ authenticated: boolean; role: string | null }>({
  authenticated: false,
  role: null,
});

export function useAuth() { return useContext(AuthContext); }

export interface AuthGateProps {
  /** Portal name displayed on the login screen, e.g. "Sales Portal" */
  portalName: string;
  /** Prefix for element IDs, e.g. "sales" → id="sales-login-username" */
  idPrefix: string;
  children: ReactNode;
}

export default function AuthGate({ portalName, idPrefix, children }: AuthGateProps) {
  const t = useTranslations('common.auth');
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (getToken()) {
      // Don't blindly trust localStorage — verify the token is still valid
      validateSession().then((valid) => {
        if (valid) {
          setAuthenticated(true);
          setRole(getRole());
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      const data = await login(username, password);
      setAuthenticated(true);
      setRole(data.role);
    } catch (err) {
      setError(t('invalidCredentials'));
      reportError(err, 'AuthGate');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg" style={{ color: 'var(--text-secondary)' }}>{t('loading')}</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-80 p-8 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-bold mb-1">{portalName}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('signInToContinue')}</p>
          <input
            id={`${idPrefix}-login-username`}
            className="input mb-3"
            placeholder={t('username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <input
            id={`${idPrefix}-login-password`}
            className="input mb-4"
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            id={`${idPrefix}-login-submit`}
            onClick={handleLogin}
            className="btn btn-primary w-full justify-center"
          >
            {t('signIn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated, role }}>
      {children}
    </AuthContext.Provider>
  );
}
