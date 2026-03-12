/**
 * API client for the NestJS backend.
 * All requests go through Next.js rewrite (/api/* → backend).
 * JWT token is stored in memory (not localStorage for SSR safety).
 */

let token: string | null = null;

export async function login(username: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  token = data.access_token;
  return data;
}

export function getToken() { return token; }
export function setToken(t: string) { token = t; }

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    token = null;
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
  if (res.status === 401) {
    token = null;
    throw new Error('Session expired');
  }
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
