/* eslint-disable i18next/no-literal-string */
'use client';

import { useEffect } from 'react';

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

function buildMailto(error: Error & { digest?: string }) {
  if (!supportEmail) return null;
  const subject = encodeURIComponent(`Error Report: ${error?.message?.slice(0, 80) || 'Unknown error'}`);
  const body = encodeURIComponent(
    [
      '--- Error Report ---',
      '',
      `Message: ${error?.message || 'Unknown'}`,
      `Digest:  ${error?.digest || 'N/A'}`,
      `URL:     ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `Time:    ${new Date().toISOString()}`,
      `Agent:   ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      '',
      '--- Stack Trace ---',
      (error?.stack || 'Not available').slice(0, 1500),
      '',
      '--- Additional Context ---',
      '(Please describe what you were doing when this error occurred)',
      '',
    ].join('\n'),
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

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

  const mailto = buildMailto(error);

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
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
            {error?.message || 'An unexpected error occurred.'}
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
            Try Again
          </button>
          {(supportPhone || supportEmail) && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 16,
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              <p style={{ marginBottom: 8 }}>If this problem persists, please contact support:</p>
              {supportPhone && (
                <p style={{ marginBottom: 4 }}>
                  📞{' '}
                  <a href={`tel:${supportPhone}`} style={{ color: '#f59e0b' }}>
                    {supportPhone}
                  </a>
                </p>
              )}
              {mailto && (
                <p>
                  ✉️{' '}
                  <a href={mailto} style={{ color: '#f59e0b' }}>
                    {supportEmail}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
