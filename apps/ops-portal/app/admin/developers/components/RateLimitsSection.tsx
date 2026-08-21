'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';

interface RateLimitsSectionProps {
  appForm: Partial<api.AppConfigResponseDto>;
  setAppForm: React.Dispatch<React.SetStateAction<Partial<api.AppConfigResponseDto>>>;
  appLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic field update bypass
  updateAppField: (field: string, value: any) => Promise<void>;
}

export function RateLimitsSection({
  appForm,
  setAppForm,
  appLoading,
  updateAppField,
}: RateLimitsSectionProps) {
  const tDev = useTranslations('admin.developers');

  return (
    <div id="rate-limits" className="card">
      <h3 className="section-heading mb-4">
        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
        <span className="material-symbols-outlined">speed</span>
        {tDev('apiRateLimits')}
      </h3>
      <div className="flex flex-col gap-1 max-w-sm">
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {tDev('maxRequestsPerMinute')}
        </label>
        <input
          type="number"
          className="input"
          value={appForm?.apiRateLimit || ''}
          onChange={(e) => setAppForm({ ...(appForm || {}), apiRateLimit: e.target.value })}
          onBlur={(e) => updateAppField('apiRateLimit', e.target.value || '1000')}
          placeholder="1000"
          disabled={appLoading}
        />
      </div>
    </div>
  );
}
