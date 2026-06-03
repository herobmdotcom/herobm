'use client';

import { useEffect } from 'react';

/**
 * Next.js global error boundary — catches errors in the root layout itself.
 *
 * This boundary cannot use components that depend on the root layout
 * (e.g. no Shell, no NextIntlClientProvider context), so it uses
 * inline styles and a raw fetch to the telemetry endpoint.
 *
 * It must provide its own <html>/<body> tags because the root layout
 * may have been the component that errored.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = error?.message ?? String(error);
    const stack = error?.stack;

    // eslint-disable-next-line no-restricted-syntax
    console.error('[GlobalError]', message, error);

    try {
      // eslint-disable-next-line no-restricted-syntax -- GlobalError runs outside root layout; apiFetch is unavailable
      fetch('/api/telemetry/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: message.slice(0, 500),
          stack: (stack ?? '').slice(0, 2000) || null,
          component: 'GlobalError',
          url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      }).catch(() => {});
    } catch {
      /* telemetry delivery is best-effort */
    }
  }, [error]);

  const errorTitle = 'Something went wrong';
  const fallbackError = 'An unexpected error occurred.';
  const tryAgain = 'Try Again';

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          background: '#0a0e1a',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 32,
            borderRadius: 16,
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {errorTitle}
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
            {error?.message || fallbackError}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#f59e0b',
              color: '#0a0e1a',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 24,
            }}
          >
            {tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
