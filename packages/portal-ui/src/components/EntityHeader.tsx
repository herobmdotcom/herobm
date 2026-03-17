'use client';

import React from 'react';

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
}: EntityHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
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
                Saving…
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {actions}
        {isDirty && onSave && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={isSaving}
          >
            {saveLabel || '💾 Save'}
          </button>
        )}
      </div>
    </div>
  );
}
