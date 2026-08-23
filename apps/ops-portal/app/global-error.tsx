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

    console.error('[GlobalError]', message, error);

    try {
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
    <html lang="en" className="herobm-light">
      <body className="m-0 min-h-screen flex items-center justify-center font-sans bg-[#0a0e1a] text-[#f8fafc]">
        <div className="max-w-[420px] p-8 rounded-2xl bg-[#111827] border border-white/[0.08] text-center">
          <h2 className="text-xl font-bold mb-2">
            {errorTitle}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {error?.message || fallbackError}
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl border-none bg-amber-500 text-[#0a0e1a] font-semibold text-sm cursor-pointer mb-6 hover:bg-amber-400 transition-colors"
          >
            {tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
