'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function DashboardQuickActions() {
  const t = useTranslations('dashboard');

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-4 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
        <span className="material-symbols-outlined text-[16px]">bolt</span>
        {t('quickActions.title')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/sales-orders/new"
          className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]">
            <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">request_quote</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
              {t('quickActions.createQuote')}
            </div>
            <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createQuoteDesc')}>
              {t('quickActions.createQuoteDesc')}
            </div>
          </div>
        </Link>

        <Link
          href="/sales-orders/new"
          className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]">
            <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">receipt_long</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
              {t('quickActions.createSalesOrder')}
            </div>
            <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createSalesDesc')}>
              {t('quickActions.createSalesDesc')}
            </div>
          </div>
        </Link>

        <Link
          href="/purchase-orders/new"
          className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]">
            <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">local_shipping</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
              {t('quickActions.createPurchaseOrder')}
            </div>
            <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createPurchaseDesc')}>
              {t('quickActions.createPurchaseDesc')}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
