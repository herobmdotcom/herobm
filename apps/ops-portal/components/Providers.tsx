'use client';

import { NextIntlClientProvider } from 'next-intl';

export default function Providers({ messages, children }: any) {
  return (
    <NextIntlClientProvider
      messages={messages}
      getMessageFallback={({ namespace, key, error }) => {
        const path = [namespace, key].filter(part => part != null).join('.');
        if (error.code === 'MISSING_MESSAGE') {
          // If the backend yields a dynamically mismatched casing (e.g. Legacy vs legacy),
          // fallback gracefully to displaying the unmapped string to the user instead of 
          // fatally destroying the React component tree!
          return path.includes('common.states.') ? key : `[${path}]`;
        }
        return `[Error: ${path}]`;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
