'use client';

import React from 'react';
import { Button } from '@/components/shared/Button';
import { useTranslations } from 'next-intl';
import PinnedReportWidget from './PinnedReportWidget';
import { PinnedReportItem } from './useDashboardData';

interface DashboardPinnedReportsSectionProps {
  pinnedReports?: PinnedReportItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External settings object with dynamic report configurations
  userSettings?: Record<string, any> | null;
  onOpenSettings: () => void;
}

export default function DashboardPinnedReportsSection({
  pinnedReports,
  userSettings,
  onOpenSettings,
}: DashboardPinnedReportsSectionProps) {
  const t = useTranslations('dashboard');

  const hasConfigOrPins =
    Object.keys(userSettings?.reportConfigs || {}).length > 0 || (pinnedReports && pinnedReports.length > 0);

  if (!hasConfigOrPins) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
          <span className="material-symbols-outlined text-[16px]">push_pin</span>
          {t('pinnedReports')}
        </div>
        <Button
          variant="ghost"
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
          title={t('managePinnedReports')}
        >
          <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">
            settings
          </span>
        </Button>
      </div>

      {!pinnedReports || pinnedReports.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-xl opacity-50 text-[14px]">
          {t('noPinnedReports')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pinnedReports.map((report, idx) => (
            <PinnedReportWidget
              key={idx}
              slug={report.slug}
              configId={report.configId}
              name={report.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
