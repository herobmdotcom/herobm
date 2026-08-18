'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useHelp } from './HelpContext';
import { Button } from '@/components/shared/Button';

export function HelpTrigger() {
  const t = useTranslations('help');
  const { toggleHelp, contextTopic } = useHelp();

  return (
    <Button
      variant="secondary"
      onClick={toggleHelp}
      className="fixed bottom-5 right-5 z-[9990] flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] transition-all hover:scale-105 cursor-pointer print:hidden group"
      aria-label={t('title')}
      title={contextTopic ? `${t('manual')}: ${contextTopic.title}` : t('manual')}
    >
      <div className="w-5 h-5 rounded-full bg-[var(--accent-glow)] text-[var(--accent)] flex items-center justify-center font-bold text-xs">
        <span className="material-symbols-outlined text-[14px]">
          help_outline
        </span>
      </div>
      <span className="text-xs font-semibold text-[var(--text-primary)] hidden sm:inline">
        {t('manual')}
      </span>
      {contextTopic && (
        <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-glow)] text-[var(--accent)] font-medium border border-[var(--accent)]/30 max-w-[140px] truncate">
          {contextTopic.title}
        </span>
      )}
    </Button>
  );
}
