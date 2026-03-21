/**
 * API client for portal frontends.
 * All requests go through Next.js rewrite (/api/* → backend).
 * JWT token is backed by localStorage so sessions survive page reloads
 * and direct URL navigation. The in-memory variables act as a fast cache.
 */

const TOKEN_KEY = 'modbm_token';
const ROLE_KEY = 'modbm_role';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

let token: string | null = readStorage(TOKEN_KEY);
let role: string | null = readStorage(ROLE_KEY);

export async function login(username: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  token = data.access_token;
  role = data.role;
  writeStorage(TOKEN_KEY, token);
  writeStorage(ROLE_KEY, role);
  return data;
}

export function getToken() { return token; }
export function setToken(t: string) { token = t; writeStorage(TOKEN_KEY, t); }
export function getRole() { return role; }

function clearSession() {
  token = null;
  role = null;
  writeStorage(TOKEN_KEY, null);
  writeStorage(ROLE_KEY, null);
}

export function logout() {
  clearSession();
  if (typeof window !== 'undefined') window.location.reload();
}

/** Clear credentials and reload so AuthGate shows the login screen. */
function clearSessionAndReload(): never {
  clearSession();
  // Using console/reportError to trace when users get forced to login page
  reportError(new Error('Session expired — forcing reload'), 'apiFetch');
  if (typeof window !== 'undefined') window.location.reload();
  throw new Error('Session expired');
}

/**
 * Validate the stored token against the API.
 * Returns true if valid, false if expired/invalid (and clears storage).
 * Used by AuthGate on startup so stale tokens don't skip the login screen.
 */
export async function validateSession(): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return true;
    // Token is expired or invalid — clear it silently
    reportError(new Error(`validateSession rejected token (Status: ${res.status})`), 'validateSession');
    clearSession();
    return false;
  } catch {
    // Network error — keep the token, let real API calls handle it
    return true;
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Fetch for binary data (e.g. PDF reports). */
export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.blob();
}

/** POST/PATCH/DELETE with JSON body. */
export async function apiMutate<T = unknown>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  if (!token) throw new Error('Not authenticated');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message ?? `API error: ${res.status}`);
  }
  // Empty response (DELETE, void methods)
  const contentLength = res.headers.get('content-length');
  if (res.status === 204 || contentLength === '0') return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

/**
 * Report a client-side error to the PLG stack via the telemetry endpoint.
 * Also logs to console for local dev visibility.
 * Fire-and-forget — never throws or blocks the caller.
 */
export function reportError(err: unknown, component?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // eslint-disable-next-line no-restricted-syntax
  console.error(`[${component ?? 'unknown'}]`, message, err);
  try {
    fetch('/api/telemetry/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // Make sure request survives page unload/reload
      body: JSON.stringify({
        message,
        stack,
        component,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {
      /* telemetry delivery is best-effort */
    });
  } catch {
    /* guard against environments where fetch is unavailable */
  }
}
