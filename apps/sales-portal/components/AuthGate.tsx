'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { login, getToken } from '@/lib/api';

const AuthContext = createContext<{ authenticated: boolean }>({ authenticated: false });

export function useAuth() { return useContext(AuthContext); }

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (getToken()) {
      setAuthenticated(true);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      await login(username, password);
      setAuthenticated(true);
    } catch {
      setError('Invalid credentials');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-80 p-8 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-bold mb-1">Sales Portal</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to continue</p>
          <input
            id="sales-login-username"
            className="input mb-3"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <input
            id="sales-login-password"
            className="input mb-4"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            id="sales-login-submit"
            onClick={handleLogin}
            className="btn btn-primary w-full justify-center"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
