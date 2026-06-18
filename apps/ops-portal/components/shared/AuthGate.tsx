'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { login, getToken, getRole, validateSession, reportError } from '../../lib/api';

const AuthContext = createContext<{ authenticated: boolean; role: string | null; permissions: { resource: string; action: string; effect: string }[] }>({
  authenticated: false,
  role: null,
  permissions: [],
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
  const [permissions, setPermissions] = useState<{ resource: string; action: string; effect: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (getToken()) {
      // Don't blindly trust localStorage — verify the token is still valid
      validateSession().then((res: { valid: boolean; data?: { role: string; permissions?: { resource: string; action: string; effect: string }[] } }) => {
        if (res.valid && res.data) {
          setRole(res.data.role);
          setPermissions(res.data.permissions || []);
          setAuthenticated(true);
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
      await login(username, password);
      const session = await validateSession();
      if (session.valid && session.data) {
        setRole(session.data.role);
        setPermissions(session.data.permissions || []);
        setAuthenticated(true);
      }
    } catch (err: unknown) {
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
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-7 h-7 rounded border-2 border-[var(--accent)] text-[var(--accent)] font-extrabold text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              H
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
              {portalName}
            </h2>
          </div>
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
    <AuthContext.Provider value={{ authenticated, role, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}
