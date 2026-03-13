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

export async function apiFetch<T = unknown>(path: string): Promise<T> {
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    token = null;
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Report a client-side error to the PLG stack via the telemetry endpoint.
 * Also logs to console for local dev visibility.
 * Fire-and-forget — never throws or blocks the caller.
 */
export function reportError(err: unknown, component?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${component ?? 'unknown'}]`, message, err);
  try {
    fetch('/api/telemetry/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
