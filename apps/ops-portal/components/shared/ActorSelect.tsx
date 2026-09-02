'use client';

import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Actor {
  actorId: string;
  name: string;
  industry?: string | null;
  email?: string | null;
  businessNumber?: string | null;
  isTaxRegistered?: boolean | null;
  headquartersCountry?: string | null;
}

interface ActorSelectProps {
  value: string | null;
  onChange: (actor: Actor | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
}

export default function ActorSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  excludeId,
}: ActorSelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<Actor>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.actorsControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const dataArray = (res.data as any)?.data || res.data || [];
        if (excludeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
          return dataArray.filter((a: any) => (a.id || a.actorId) !== excludeId);
        }
        return dataArray;
      }}
      onChange={onChange}
      getKey={(a) => a.actorId}
      getLabel={(a) => a.name}
      renderOption={(a) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold">{a.name}</span>
            {a.industry && (
              <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
                ({a.industry})
              </span>
            )}
          </div>
          {a.email && (
            <div className="text-[var(--text-secondary)] text-xs">
              {a.email}
            </div>
          )}
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
