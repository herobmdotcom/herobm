'use client';

import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  currencyCode?: string;
}

interface SupplierSelectProps {
  value: string | null;
  onChange: (supplier: Supplier | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
}

export default function SupplierSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
}: SupplierSelectProps) {
  const t = useTranslations('common');

  return (
    <AsyncSelect<Supplier>
      value={value}
      displayValue={initialSearchTerm}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.suppliersControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        return (res.data as any)?.data || res.data || [];
      }}
      onChange={onChange}
      getKey={(s) => s.vendorId}
      renderOption={(s) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {s.vendorNumber}
            </span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 13 }}>
              {s.name}
            </span>
          </div>
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
