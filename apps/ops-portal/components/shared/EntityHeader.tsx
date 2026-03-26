'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

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
}: EntityHeaderProps) {
  const t = useTranslations('common');
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            aria-label="Go back"
          >
            ←
          </button>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{title}</h1>
            {badges}
            {isSaving && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('saving')}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
          {nav}
        </div>
      </div>
      <div className="flex items-start gap-2">
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
  );
}
