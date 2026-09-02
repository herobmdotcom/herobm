'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import {
  QuickActionItem,
  DEFAULT_QUICK_ACTIONS,
} from './QuickActionsSettingsSlideOver';

interface DashboardQuickActionsProps {
  quickActions?: QuickActionItem[];
  onOpenSettings?: () => void;
}

export default function DashboardQuickActions({
  quickActions,
  onOpenSettings,
}: DashboardQuickActionsProps) {
  const t = useTranslations('dashboard');

  const actionsToRender = (
    quickActions && quickActions.length > 0 ? quickActions : DEFAULT_QUICK_ACTIONS
  ).filter((a) => a.enabled);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          {t('quickActions.title')}
        </div>

        {onOpenSettings && (
          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
            title={t('quickActions.manage')}
          >
            <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">
              {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
              {'settings'}
            </span>
          </Button>
        )}
      </div>

      {actionsToRender.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-xl opacity-50 text-[14px] text-[var(--text-muted)]">
          {t('quickActions.noCustomActions')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actionsToRender.map((action) => {
            const isExternal =
              action.href.startsWith('http://') ||
              action.href.startsWith('https://');

            const title = action.isCustom
              ? action.title
              : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic translation key for presets
                t(`quickActions.${action.title}` as any);

            const desc = action.description
              ? action.isCustom
                ? action.description
                : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic translation key for presets
                  t(`quickActions.${action.description}` as any)
              : '';

            const sanitizedIcon =
              action.icon?.toLowerCase().trim().replace(/[\s-]+/g, '_') || 'bolt';

            const cardContent = (
              <>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]">
                  <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">
                    {sanitizedIcon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug truncate">
                    <span className="truncate">{title}</span>
                    {isExternal && (
                      <span className="material-symbols-outlined text-[14px] opacity-40 shrink-0">
                        {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
                        {'open_in_new'}
                      </span>
                    )}
                  </div>
                  {desc && (
                    <div
                      className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight"
                      title={desc}
                    >
                      {desc}
                    </div>
                  )}
                </div>
              </>
            );

            const commonClasses =
              'group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]';

            if (isExternal) {
              return (
                <a
                  key={action.id}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={commonClasses}
                >
                  {cardContent}
                </a>
              );
            }

            return (
              <Link key={action.id} href={action.href} className={commonClasses}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
