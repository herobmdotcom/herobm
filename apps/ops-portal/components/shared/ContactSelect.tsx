'use client';

import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Contact {
  contactId: string;
  firstName: string;
  lastName: string;
  fullName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
}

interface ContactSelectProps {
  value: string | null;
  onChange: (contact: Contact | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
}

export default function ContactSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  excludeId,
}: ContactSelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<Contact>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.contactsControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const dataArray = (res.data as any)?.data || res.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const mapped = dataArray.map((c: any) => ({ ...c, contactId: c.id || c.contactId }));
        if (excludeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
          return mapped.filter((c: any) => c.contactId !== excludeId);
        }
        return mapped;
      }}
      onChange={onChange}
      getKey={(c) => c.contactId}
      getLabel={(c) => `${c.firstName} ${c.lastName}`.trim()}
      renderOption={(c) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {c.firstName} {c.lastName}
            </span>
            {c.jobTitle && (
              <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 13 }}>
                ({c.jobTitle})
              </span>
            )}
          </div>
          {c.email && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {c.email}
            </div>
          )}
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
