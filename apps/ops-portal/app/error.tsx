'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/** Best-effort telemetry — doesn't depend on any shared lib import */
function sendTelemetry(error: Error & { digest?: string }) {
  const message = error?.message || String(error) || 'Unknown error';
  const stack = error?.stack;
  const url = typeof window !== 'undefined' ? window.location.href : null;

  // Always log to console so it shows up in the Turbopack terminal
  // eslint-disable-next-line no-restricted-syntax
  console.error('[ErrorBoundary]', message, '\nURL:', url, '\nDigest:', error?.digest, '\n', error);

  try {
    // eslint-disable-next-line no-restricted-syntax -- ErrorBoundary runs outside normal app context; apiFetch may be unavailable
    fetch('/api/telemetry/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: message.slice(0, 500),
        stack: (stack ?? '').slice(0, 2000) || null,
        component: 'ErrorBoundary',
        url,
      }),
    }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

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
 * Next.js page-level error boundary.
 *
 * Catches errors thrown during rendering of any page component
 * (but not the root layout — that's handled by global-error.tsx).
 *
 * Uses a raw fetch for telemetry (instead of importing reportError)
 * to ensure it works even if shared lib modules fail to load.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common.errorBoundary');

  useEffect(() => {
    sendTelemetry(error);
  }, [error]);

  const mailto = buildMailto(error);
  const displayMessage = error?.message && error.message !== 'An error occurred in the Server Components render.'
    ? error.message
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="max-w-md p-8 rounded-2xl text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-xl font-bold mb-2">{t('title')}</h2>
        <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
          {displayMessage || t('unexpected')}
        </p>
        {error?.digest && (
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            {t('reference', { digest: error.digest })}
          </p>
        )}
        {typeof window !== 'undefined' && (
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            {t('page', { path: window.location.pathname })}
          </p>
        )}
        <button onClick={reset} className="btn btn-primary mb-6">
          {t('tryAgain')}
        </button>
        {(supportPhone || supportEmail) && (
          <div
            className="text-xs pt-4"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <p className="mb-2">{t('contactSupport')}</p>
            {supportPhone && (
              <p className="mb-1">
                📞{' '}
                <a href={`tel:${supportPhone}`} style={{ color: 'var(--accent)' }}>
                  {supportPhone}
                </a>
              </p>
            )}
            {mailto && (
              <p>
                {/* eslint-disable i18next/no-literal-string */}
                <span>✉️</span>
                {/* eslint-enable i18next/no-literal-string */}
                {' '}
                <a href={mailto} style={{ color: 'var(--accent)' }}>
                  {supportEmail}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
