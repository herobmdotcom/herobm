import type { Metadata, Viewport } from 'next';
import './globals.css';
import ErrorReporter from '@/components/ErrorReporter';
import { Toaster } from 'react-hot-toast';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Shell from '@/components/Shell';
import { SettingsProvider } from '@/components/SettingsProvider';

export const viewport: Viewport = {
  themeColor: '#006b5c',
};

export const metadata: Metadata = {
  title: {
    default: 'HeroBM',
    template: '%s | HeroBM',
  },
  description: 'Modern, real-time business management and operations platform',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
      },
    ],
  },
  manifest: '/site.webmanifest',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  if (navigator.language) { document.documentElement.lang = navigator.language; }
  var p = localStorage.getItem('herobm_user_prefs');
  var prefs = p ? JSON.parse(p) : {};
  if (prefs.density) { document.documentElement.setAttribute('data-density', prefs.density); }
  var theme = prefs.theme || 'system';
  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark', 'herobm-dark');
    document.documentElement.classList.remove('herobm-light');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.add('herobm-light');
    document.documentElement.classList.remove('dark', 'herobm-dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
} catch (_) { /* ignore */ }`,
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages} locale="en">
          <ErrorReporter />
          <Toaster
            position="top-center"
            containerStyle={{
              top: 40,
              zIndex: 1000000,
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

