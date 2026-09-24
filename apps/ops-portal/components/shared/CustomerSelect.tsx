'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { SYSTEM_WALK_IN_CUSTOMER_ID } from '@herobm/shared';
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

export interface CustomerSelectProps {
  value: string | null;
  onChange: (customer: Customer | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
  /** When enabled, includes "Walk-In Customer" as a selectable option */
  allowWalkIn?: boolean;
  /** Optional customerId to bind when Walk-In is selected (defaults to 'walk-in') */
  walkInCustomerId?: string;
  viewUrl?: string;
  viewUrlTitle?: string;
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
  allowWalkIn = false,
  walkInCustomerId,
  viewUrl = value && value !== SYSTEM_WALK_IN_CUSTOMER_ID && value !== (walkInCustomerId || 'walk-in')
    ? `/customers/${value}`
    : undefined,
  viewUrlTitle,
}: CustomerSelectProps) {
  const t = useTranslations('common');
  const [fetchedDisplay, setFetchedDisplay] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (value && !initialSearchTerm) {
      if (allowWalkIn && value === (walkInCustomerId || SYSTEM_WALK_IN_CUSTOMER_ID)) {
        setFetchedDisplay('Walk-In Customer');
        return;
      }
      const promise = api.customersControllerFindOne?.(value);
      if (promise?.then) {
        promise
          .then((res) => {
            if (!active) return;
            const cust = res?.data;
            if (cust) {
              setFetchedDisplay(
                cust.name ? `${cust.customerNumber} — ${cust.name}` : cust.customerNumber || ''
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
  }, [value, initialSearchTerm, allowWalkIn, walkInCustomerId]);

  const displayValue = initialSearchTerm || fetchedDisplay;

  return (
    <AsyncSelect<Customer>
      value={value}
      displayValue={displayValue}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      viewUrl={viewUrl}
      viewUrlTitle={viewUrlTitle}
      onSearch={async (term) => {
        const lower = term.toLowerCase().trim();
        const results: Customer[] = [];

        if (allowWalkIn && (!lower || lower.includes('walk') || lower.includes('cash') || lower.includes('counter'))) {
          results.push({
            customerId: walkInCustomerId || SYSTEM_WALK_IN_CUSTOMER_ID,
            customerNumber: 'WALK-IN',
            name: 'Walk-In Customer',
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.customersControllerFindAll({ q: term, limit: 10 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const dataArray = (res.data as any)?.data || res.data || [];
        const filtered = excludeId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
          ? dataArray.filter((c: any) => c.customerId !== excludeId)
          : dataArray;

        filtered.forEach((c: Customer) => {
          if (!results.some((r) => r.customerId === c.customerId)) {
            results.push(c);
          }
        });

        return results;
      }}
      onChange={onChange}
      getKey={(c) => c.customerId}
      getLabel={(c) => (c.name === 'Walk-In Customer' ? 'Walk-In Customer' : `${c.customerNumber} — ${c.name}`)}
      renderOption={(c) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold font-mono text-xs">
              {c.customerNumber}
            </span>
            <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
              {c.name}
            </span>
          </div>
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
