'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/api';

/**
 * Invisible client component that forwards all uncaught JS errors
 * and unhandled promise rejections to the PLG telemetry endpoint.
 *
 * Mount once in the root layout so every page is covered.
 */
export default function ErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportError(event.error ?? event.message, 'window.onerror');
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      reportError(event.reason, 'unhandledrejection');
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
