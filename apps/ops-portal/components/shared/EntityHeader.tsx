'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import PrintButton from './PrintButton';

export interface EntityHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  badges?: React.ReactNode;
  onBack?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  onSave?: () => void;
  saveLabel?: string;
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
  onBack,
  isSaving,
  isDirty,
  onSave,
  saveLabel,
  actions,
  nav,
  showPrint = true,
}: EntityHeaderProps) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between lg:items-start">
        {/* Mobile Action Bar / Desktop Actions Row */}
        <div className="order-1 lg:order-2 flex flex-col lg:flex-row items-stretch lg:items-center lg:justify-end -mx-4 lg:mx-0 px-4 lg:px-0 pb-3 lg:pb-0 border-b lg:border-none border-[rgba(196,198,205,0.2)] mb-3 lg:mb-0 shrink-0 gap-2 lg:gap-4">
          {nav && <div className="hidden [@media(any-pointer:fine)]:lg:block">{nav}</div>}
          <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto">
            <div className="lg:hidden">
              {onBack && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={onBack}
                  aria-label="Go back"
                >
                  ←
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {showPrint && <PrintButton />}
              {actions}
              {isDirty && onSave && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {saveLabel || `💾 ${t('save')}`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="order-2 lg:order-1 min-w-0 flex items-start gap-5">
          <div className="hidden lg:block">
            {onBack && (
              <button
                className="btn btn-secondary btn-sm mt-1"
                onClick={onBack}
                aria-label="Go back"
              >
                ←
              </button>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-row items-center gap-2 sm:gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold truncate break-all sm:break-normal">{title}</h1>
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
        <div className="mt-4 block [@media(any-pointer:fine)]:lg:hidden pb-1 overflow-x-auto w-full hide-scrollbar">
          {nav}
        </div>
      )}
    </div>
  );
}
