'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import AsyncSelect from './AsyncSelect';

export interface Product {
  productId: string;
  productNumber: string;
  name: string;
  listPrice?: string | number | null;
  tradePrice?: string | number | null;
  standardCost?: string | number | null;
  baseUom?: string | null;
  productType?: string | null;
}

export interface ProductSelectProps {
  value: string | null;
  onChange: (product: Product | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  productType?: string;
  viewUrl?: string;
  viewUrlTitle?: string;
}

export default function ProductSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  productType,
  viewUrl = value ? `/products/${value}` : undefined,
  viewUrlTitle,
}: ProductSelectProps) {
  const t = useTranslations('common');
  const [fetchedDisplay, setFetchedDisplay] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (value && !initialSearchTerm) {
      const promise = api.productsControllerFindOne?.(value);
      if (promise?.then) {
        promise
          .then((res) => {
            if (!active) return;
            const prod = res?.data;
            if (prod) {
              const label = prod.baseUom
                ? `${prod.productNumber} — ${prod.name} (${prod.baseUom})`
                : `${prod.productNumber} — ${prod.name}`;
              setFetchedDisplay(label);
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
    <AsyncSelect<Product>
      value={value}
      displayValue={displayValue}
      placeholder={placeholder || t('selectEllipsis')}
      disabled={disabled}
      required={required}
      className={className}
      viewUrl={viewUrl}
      viewUrlTitle={viewUrlTitle}
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO query parameter bypass
        const queryParams: any = { q: term, limit: 10 };
        if (productType) {
          queryParams.productType = productType;
        }
        const res = await api.productsControllerFindAll(queryParams);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        return (res.data as any)?.data || res.data || [];
      }}
      onChange={onChange}
      getKey={(p) => p.productId}
      getLabel={(p) =>
        p.baseUom
          ? `${p.productNumber} — ${p.name} (${p.baseUom})`
          : `${p.productNumber} — ${p.name}`
      }
      renderOption={(p) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold">
              {p.productNumber}
            </span>
            <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
              {p.name}
            </span>
            {p.baseUom && (
              <span className="text-[var(--text-muted)] ml-2 text-xs">
                ({p.baseUom})
              </span>
            )}
          </div>
        </div>
      )}
      noResultsText={t('noMatchingResults')}
    />
  );
}
