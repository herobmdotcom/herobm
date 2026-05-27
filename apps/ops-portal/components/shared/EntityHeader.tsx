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
      {/* Top Action Bar */}
      <div className="-mx-4 lg:-mx-6 px-4 lg:px-6 flex items-center justify-between pb-3 border-b border-[rgba(196,198,205,0.2)] mb-3">
        <div>
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

      {/* Title Section */}
      <div className="min-w-0">
        <div className="flex items-center flex-wrap gap-2">
          <h1 className="text-2xl font-bold truncate">{title}</h1>
          {badges}
          {isSaving && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('saving')}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
        {nav && <div className="mt-2">{nav}</div>}
      </div>
    </div>
  );
}
