'use client';

import React from 'react';
import { Button } from '@/components/shared/Button';
import { useTranslations } from 'next-intl';
import DashboardTimeline from './DashboardTimeline';
import { EventType } from './TimelineSettingsSlideOver';

interface DashboardTimelineSectionProps {
  enabledEvents: EventType[];
  isLoaded: boolean;
  onOpenSettings: () => void;
}

export default function DashboardTimelineSection({
  enabledEvents,
  isLoaded,
  onOpenSettings,
}: DashboardTimelineSectionProps) {
  const tTimeline = useTranslations('dashboard.timeline');

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined text-[16px]">history</span>
          {tTimeline('title')}
        </div>

        <Button
          variant="ghost"
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
          title={tTimeline('settings')}
        >
          <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">
            settings
          </span>
        </Button>
      </div>

      <div className="flex-1 min-h-[400px]">
        {isLoaded && <DashboardTimeline enabledEvents={enabledEvents} />}
      </div>
    </div>
  );
}
