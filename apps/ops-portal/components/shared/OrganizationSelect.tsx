'use client';

import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Organization {
  organizationId: string;
  name: string;
  industry?: string | null;
  email?: string | null;
  businessNumber?: string | null;
  isTaxRegistered?: boolean | null;
  headquartersCountry?: string | null;
}

export type Actor = Organization;

interface OrganizationSelectProps {
  value: string | null;
  onChange: (organization: Organization | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
}

export default function OrganizationSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  excludeId,
}: OrganizationSelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<Organization>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        const res = await api.organizationsControllerFindAll({ q: term, limit: 10 });
        const responseData = res.data as unknown;
        const dataArray: Organization[] =
          typeof responseData === 'object' &&
          responseData !== null &&
          'data' in responseData &&
          Array.isArray((responseData as { data: unknown }).data)
            ? (responseData as { data: Organization[] }).data
            : Array.isArray(responseData)
              ? (responseData as Organization[])
              : [];
        if (excludeId) {
          return dataArray.filter(
            (a) =>
              a.organizationId !== excludeId &&
              (a as unknown as { id?: string; actorId?: string }).id !== excludeId &&
              (a as unknown as { id?: string; actorId?: string }).actorId !== excludeId,
          );
        }
        return dataArray;
      }}
      onChange={onChange}
      getKey={(a) => a.organizationId}
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
