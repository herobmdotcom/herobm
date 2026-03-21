import { getRequestConfig } from 'next-intl/server';
import type { IntlErrorCode } from 'next-intl';

export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    onError(error: { code: IntlErrorCode; message: string }) {
      if (error.code === 'MISSING_MESSAGE') {
        // Downgrade to warning — the fallback text is shown instead
        console.warn(`[next-intl] ${error.message}`);
      } else {
        // Other errors (e.g. INSUFFICIENT_PATH) are still reported as errors
        console.error(`[next-intl] ${error.message}`);
      }
    },
    getMessageFallback({ namespace, key }: { namespace?: string; key: string }) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return `[MISSING: ${fullKey}]`;
    },
  };
});
