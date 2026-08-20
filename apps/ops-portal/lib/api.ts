/**
 * API client for portal frontends.
 * All requests go through Next.js rewrite (/api/* → backend).
 * JWT token is backed by localStorage so sessions survive page reloads
 * and direct URL navigation. The in-memory variables act as a fast cache.
 */

export class ApiError extends Error {
  public status: number;
  public data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

const TOKEN_KEY = 'herobm_token';
const ROLE_KEY = 'herobm_role';
const USERNAME_KEY = 'herobm_username';
const DISPLAY_NAME_KEY = 'herobm_display_name';
const PERMISSIONS_KEY = 'herobm_permissions';

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

import { setSdkConfig } from '@herobm/sdk';

let token: string | null = readStorage(TOKEN_KEY);
let role: string | null = readStorage(ROLE_KEY);
let username: string | null = readStorage(USERNAME_KEY);
let displayName: string | null = readStorage(DISPLAY_NAME_KEY);

// Wire up the new @herobm/sdk to use the portal's token and error handling
setSdkConfig({
  baseUrl: '/api', // Using Next.js rewrites, so relative URL is correct
  getToken: () => token,
  onUnauthorized: () => clearSessionAndReload(),
  onError: (error) => reportError(error, 'SDK'),
});


export async function login(user: string, pass: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new ApiError(errData?.message ?? 'Login failed', res.status, errData);
  }
  const data = await res.json();
  token = data.access_token;
  role = data.role;
  username = data.username || user;
  displayName = data.displayName || null;
  writeStorage(TOKEN_KEY, token);
  writeStorage(ROLE_KEY, role);
  writeStorage(USERNAME_KEY, username);
  writeStorage(DISPLAY_NAME_KEY, displayName);
  return data;
}

export function getToken() { return token; }
export function setToken(t: string) { token = t; writeStorage(TOKEN_KEY, t); }
export function getRole() { return role; }
export function getUsername() { return username; }
export function getDisplayName() { return displayName; }
export function getPermissions(): { resource: string; action: string; effect: string }[] {
  const raw = readStorage(PERMISSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearSession() {
  token = null;
  role = null;
  username = null;
  displayName = null;
  writeStorage(TOKEN_KEY, null);
  writeStorage(ROLE_KEY, null);
  writeStorage(USERNAME_KEY, null);
  writeStorage(DISPLAY_NAME_KEY, null);
  writeStorage(PERMISSIONS_KEY, null);
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
export async function validateSession(): Promise<{ valid: boolean; data?: any; fromCache?: boolean }> {
  if (!token) return { valid: false };
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        username = data.username;
        writeStorage(USERNAME_KEY, username);
      }
      if (data.displayName !== undefined) {
        displayName = data.displayName;
        writeStorage(DISPLAY_NAME_KEY, displayName);
      }
      if (Array.isArray(data.permissions)) {
        writeStorage(PERMISSIONS_KEY, JSON.stringify(data.permissions));
      }
      return { valid: true, data, fromCache: false };
    }
    // Only clear session if the backend explicitly rejected the token as invalid/unauthorized
    if (res.status === 401 || res.status === 403) {
      console.info(`[validateSession] Token rejected/expired (Status: ${res.status})`);
      clearSession();
      return { valid: false };
    }
    // Server error (e.g. 502/503/504 while API is booting) — preserve cached session
    console.warn(`[validateSession] API unavailable (Status: ${res.status}). Preserving cached session.`);
    return {
      valid: true,
      data: {
        role: getRole(),
        username: getUsername(),
        displayName: getDisplayName(),
        permissions: getPermissions(),
      },
      fromCache: true,
    };
  } catch (err) {
    // Network error or timeout (API starting up) — keep the token, let real API calls handle it
    console.warn('[validateSession] API unreachable or timed out. Preserving cached session.', err);
    return {
      valid: true,
      data: {
        role: getRole(),
        username: getUsername(),
        displayName: getDisplayName(),
        permissions: getPermissions(),
      },
      fromCache: true,
    };
  }
}

/**
 * Fetches data from the API (GET requests).
 * The JWT token is automatically injected.
 * 
 * @example
 * // Correct:
 * const data = await apiFetch<User>('/api/users/me');
 * 
 * @example
 * // Incorrect: DO NOT use this for POST/PATCH (use apiMutate instead).
 * // Incorrect: DO NOT stringify JSON bodies here.
 */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error('Not authenticated');
  
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new ApiError(errData?.message ?? `API error: ${res.status}`, res.status, errData);
  }
  return res.json();
}

/** 
 * Fetch for binary data (e.g. PDF reports). 
 * 
 * @example
 * const blob = await apiFetchBlob('/api/reports/invoice.pdf');
 * const url = URL.createObjectURL(blob);
 */
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
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errData;
    try { errData = errText ? JSON.parse(errText) : null; } catch { errData = { message: errText }; }
    throw new ApiError(errData?.message ?? `API error: ${res.status}`, res.status, errData);
  }
  return res.blob();
}

/** 
 * Performs state-mutating requests (POST, PATCH, DELETE) with a JSON body.
 * Automatically injects headers and stringifies the body.
 * 
 * @example
 * // Correct: Pass raw object as body
 * await apiMutate('/api/users', 'POST', { name: 'Alice' });
 * 
 * @example
 * // Incorrect: DO NOT stringify the body yourself.
 * await apiMutate('/api/users', 'POST', JSON.stringify({ name: 'Alice' }));
 */
export async function apiMutate<T = unknown>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  if (!token) throw new Error('Not authenticated');

  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new ApiError(errData?.message ?? `API error: ${res.status}`, res.status, errData);
  }
  // Empty response (DELETE, void methods)
  const contentLength = res.headers.get('content-length');
  if (res.status === 204 || contentLength === '0') return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

/**
 * Perform an authenticated multipart/form-data upload.
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  if (!token) throw new Error('Not authenticated');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(path, {
    method,
    headers,
    body: formData,
  });
  if (res.status === 401) clearSessionAndReload();
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new ApiError(errData?.message ?? `Upload failed: ${res.status}`, res.status, errData);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

/**
 * Report a client-side error to the centralized telemetry endpoint.
 * Also logs to console for local dev visibility.
 * Fire-and-forget — never throws or blocks the caller.
 */
export function reportError(err: unknown, component?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // eslint-disable-next-line no-restricted-syntax -- External API integration boundaries where exact types are unknown.
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
