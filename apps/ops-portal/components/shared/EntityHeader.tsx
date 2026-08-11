'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface EntityHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  badges?: React.ReactNode;
  isSaving?: boolean;
  actions?: React.ReactNode;
  /** Optional section quick-nav rendered below the subtitle */
  nav?: React.ReactNode;
  /** Show the print button — defaults to true */
  showPrint?: boolean;
}

export default function EntityHeader({
  title,
  subtitle,
  badges,
  isSaving,
  actions,
  nav,
}: EntityHeaderProps) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between lg:items-start">
        {/* Mobile Action Bar / Desktop Actions Row */}
        <div className="order-1 lg:order-2 flex flex-col lg:flex-row items-stretch lg:items-center lg:justify-end -mx-4 lg:mx-0 px-4 lg:px-0 pb-3 lg:pb-0 border-b lg:border-none border-[rgba(196,198,205,0.2)] mb-3 lg:mb-0 shrink-0 gap-2 lg:gap-4">
          {nav && <div className="hidden lg:block">{nav}</div>}
          <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto">
            <div className="lg:hidden">

            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {actions}
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="order-2 lg:order-1 min-w-0 flex items-start gap-5">
          <div className="hidden lg:block">

          </div>
          <div className="min-w-0">
            <div className="flex flex-row items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-2xl font-bold truncate min-w-0 break-all sm:break-normal">{title}</h1>
              {(badges || isSaving) && (
                <div className="flex items-center gap-2 shrink-0">
                  {badges}
                  {isSaving && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('saving')}
                    </span>
                  )}
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {nav && (
        <div className="mt-4 block lg:hidden pb-1 overflow-x-auto w-full hide-scrollbar">
          {nav}
        </div>
      )}
    </div>
  );
}
