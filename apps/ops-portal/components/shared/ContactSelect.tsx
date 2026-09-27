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
  clearOnSelect?: boolean;
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
  clearOnSelect,
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
      clearOnSelect={clearOnSelect}
      onSearch={async (term) => {
        const res = await api.contactsControllerFindAll({ q: term, limit: 10 });
        const responseData = res.data as unknown;
        const dataArray: Contact[] =
          typeof responseData === 'object' &&
          responseData !== null &&
          'data' in responseData &&
          Array.isArray((responseData as { data: unknown }).data)
            ? (responseData as { data: Contact[] }).data
            : Array.isArray(responseData)
              ? (responseData as Contact[])
              : [];
        const mapped = dataArray.map((c) => ({
          ...c,
          contactId: (c as unknown as { id?: string }).id || c.contactId,
        }));
        if (excludeId) {
          return mapped.filter((c) => c.contactId !== excludeId);
        }
        return mapped;
      }}
      onChange={onChange}
      getKey={(c) => c.contactId}
      getLabel={(c) => `${c.firstName} ${c.lastName}`.trim()}
      renderOption={(c) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold">
              {c.firstName} {c.lastName}
            </span>
            {c.jobTitle && (
              <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
                ({c.jobTitle})
              </span>
            )}
          </div>
          {c.email && (
            <div className="text-[var(--text-secondary)] text-xs">
              {c.email}
            </div>
          )}
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
