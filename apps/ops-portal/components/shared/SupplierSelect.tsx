'use client';

import React, { useState, useEffect } from 'react';
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
  viewUrl?: string;
  viewUrlTitle?: string;
}

export default function SupplierSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  viewUrl = value ? `/suppliers/${value}` : undefined,
  viewUrlTitle,
}: SupplierSelectProps) {
  const t = useTranslations('common');
  const [fetchedDisplay, setFetchedDisplay] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (value && !initialSearchTerm) {
      const promise = api.suppliersControllerFindOne?.(value);
      if (promise?.then) {
        promise
          .then((res) => {
            if (!active) return;
            const sup = res?.data;
            if (sup) {
              setFetchedDisplay(
                sup.name ? `${sup.vendorNumber} — ${sup.name}` : sup.vendorNumber || ''
              );
            }
          })
          .catch(() => {
            // ignore error
          });
      }
    } else {
      setFetchedDisplay('');
    }
    return () => {
      active = false;
    };
  }, [value, initialSearchTerm]);

  const displayValue = initialSearchTerm || fetchedDisplay;

  return (
    <AsyncSelect<Supplier>
      value={value}
      displayValue={displayValue}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      viewUrl={viewUrl}
      viewUrlTitle={viewUrlTitle}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.suppliersControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        return (res.data as any)?.data || res.data || [];
      }}
      onChange={onChange}
      getKey={(s) => s.vendorId}
      getLabel={(s) => `${s.vendorNumber} — ${s.name}`}
      renderOption={(s) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold">
              {s.vendorNumber}
            </span>
            <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
              {s.name}
            </span>
          </div>
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
