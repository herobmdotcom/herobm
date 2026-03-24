'use client';

import Shell from '@/components/Shell';
import UniversalSearch from '@/components/shared/UniversalSearch';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <Shell>
      <div className="p-8 h-full overflow-y-auto">
        <h2 className="text-2xl font-bold mb-8">{t('title')}</h2>
        <UniversalSearch />
      </div>
    </Shell>
  );
}
