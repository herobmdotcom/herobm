'use client';

import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Customer {
  customerId: string;
  customerNumber: string;
  name: string;
  currencyCode?: string;
  customerGroupId?: string | null;
  customerDiscount?: string | null;
  taxPosition?: string | null;
  taxPositionId?: string | null;
  customerGroupTaxPositionId?: string | null;
}

interface AccountSelectProps {
  value: string | null;
  onChange: (customer: Customer | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
}

export default function CustomerSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  excludeId,
}: AccountSelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<Customer>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.customersControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const dataArray = (res.data as any)?.data || res.data || [];
        if (excludeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
          return dataArray.filter((c: any) => c.customerId !== excludeId);
        }
        return dataArray;
      }}
      onChange={onChange}
      getKey={(c) => c.customerId}
      getLabel={(c) => `${c.customerNumber} — ${c.name}`}
      renderOption={(c) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {c.customerNumber}
            </span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 13 }}>
              {c.name}
            </span>
          </div>
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
