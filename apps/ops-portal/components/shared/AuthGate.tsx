'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { login, getToken, getRole, validateSession, reportError } from '../../lib/api';
import { Button } from './Button';

const AuthContext = createContext<{
  authenticated: boolean;
  role: string | null;
  username: string | null;
  displayName: string | null;
  permissions: { resource: string; action: string; effect: string }[];
}>({
  authenticated: false,
  role: null,
  username: null,
  displayName: null,
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
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<{ resource: string; action: string; effect: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let mounted = true;
    if (getToken()) {
      // Don't blindly trust localStorage — verify the token is still valid
      validateSession().then((res: { valid: boolean; data?: { role: string; username?: string; displayName?: string | null; permissions?: { resource: string; action: string; effect: string }[] }; fromCache?: boolean }) => {
        if (!mounted) return;
        if (res.valid && res.data) {
          setRole(res.data.role);
          setCurrentUsername(res.data.username || null);
          setDisplayName(res.data.displayName || null);
          setPermissions(res.data.permissions || []);
          setAuthenticated(true);

          if (res.fromCache) {
            // Background revalidation to refresh permissions as soon as API is reachable
            setTimeout(() => {
              validateSession().then((reval) => {
                if (!mounted) return;
                if (reval.valid && reval.data && !reval.fromCache) {
                  setRole(reval.data.role);
                  setCurrentUsername(reval.data.username || null);
                  setDisplayName(reval.data.displayName || null);
                  setPermissions(reval.data.permissions || []);
                }
              }).catch(() => {});
            }, 1000);
          }
        }
        setLoading(false);
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      await login(username, password);
      const session = await validateSession();
      if (session.valid && session.data) {
        setRole(session.data.role);
        setCurrentUsername(session.data.username || username);
        setDisplayName(session.data.displayName || null);
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
        <div className="animate-pulse text-lg text-[var(--text-secondary)]">{t('loading')}</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-80 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-7 h-7 rounded border-2 border-[var(--accent)] text-[var(--accent)] font-extrabold text-lg">
              H
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {portalName}
            </h2>
          </div>
          <p className="text-sm mb-6 text-[var(--text-muted)]">{t('signInToContinue')}</p>
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
          {error && <p className="text-sm mb-3 text-[var(--danger)]">{error}</p>}
          <Button
            id={`${idPrefix}-login-submit`}
            onClick={handleLogin}
            className="w-full justify-center"
            variant="primary"
          >
            {t('signIn')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        role,
        username: currentUsername,
        displayName,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
