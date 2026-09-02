'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-4">
      <div className="w-full max-w-md p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-md text-center">
        <h1 className="text-5xl font-extrabold mb-3 text-[var(--accent)] tracking-tight">404</h1>
        <h2 className="text-lg font-bold mb-2 text-[var(--text-primary)]">{t('pageNotFound')}</h2>
        <p className="text-sm mb-6 text-[var(--text-muted)]">
          {t('pageNotFoundDescription')}
        </p>
        
        <Link href="/" className="btn btn-primary inline-flex justify-center w-full mb-2">
          {t('goBackHome')}
        </Link>
      </div>
    </div>
  );
}
