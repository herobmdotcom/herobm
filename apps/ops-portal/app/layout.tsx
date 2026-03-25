import type { Metadata } from 'next';
import './globals.css';
import ErrorReporter from '@/components/ErrorReporter';
import { Toaster } from 'react-hot-toast';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'modbm',
  description: 'Business management portal',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ErrorReporter />
          <Toaster
            position="top-center"
            containerStyle={{
              top: 40,
            }}
            toastOptions={{
              duration: 3000,
              style: {
                background: '#0f172a',
                color: '#f8fafc',
                padding: '6px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '13px',
                fontWeight: '500',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                maxWidth: 500,
              },
            }}
          />
          <Shell>
            {children}
          </Shell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}


