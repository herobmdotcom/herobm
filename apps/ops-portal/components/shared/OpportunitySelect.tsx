'use client';

import React from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface OpportunityOption {
  opportunityId: string;
  name: string;
  status?: string | null;
  estimatedValue?: number | null;
  currencyCode?: string | null;
}

interface OpportunitySelectProps {
  value: string | null;
  onChange: (opportunity: OpportunityOption | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
}

export default function OpportunitySelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
}: OpportunitySelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<OpportunityOption>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO structure bypass
        const res = await api.opportunitiesControllerFindAll({ limit: 100 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO structure bypass
        const dataArray = (res.data as any)?.data || res.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO structure bypass
        const mapped: OpportunityOption[] = dataArray.map((o: any) => ({
          opportunityId: o.opportunityId,
          name: o.name,
          status: o.status,
          estimatedValue: o.estimatedValue,
          currencyCode: o.currencyCode,
        }));
        if (!term || term.trim().length === 0) return mapped.slice(0, 10);
        const lower = term.toLowerCase().trim();
        return mapped.filter((o) => o.name?.toLowerCase().includes(lower)).slice(0, 10);
      }}
      onChange={onChange}
      getKey={(o) => o.opportunityId}
      getLabel={(o) => o.name}
      renderOption={(o) => (
        <div className="flex flex-col gap-1 pt-1 pb-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--accent)] font-semibold truncate">{o.name}</span>
            {o.status && (
              <span className="text-[11px] font-medium uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                {o.status}
              </span>
            )}
          </div>
          {o.estimatedValue !== undefined && o.estimatedValue !== null && (
            <div className="text-[var(--text-muted)] text-xs">
              {o.currencyCode || ''} {Number(o.estimatedValue).toLocaleString()}
            </div>
          )}
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
