'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatAmount } from '@/lib/currency';
import { getTaxLabel, LineType } from '@herobm/shared';
import type { OrderLineItem, TaxCategory } from '../types';

interface TaxCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  taxCategories: TaxCategory[];
  currencyCode?: string;
  isEditable: boolean;
  externalTaxProvider?: string | null;
  isTaxStale?: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
  onUpdateLineFields?: (indexOrId: string | number, fields: Record<string, unknown>) => void | Promise<void>;
}

export function TaxCell({
  line,
  lineIdentifier,
  taxCategories,
  currencyCode = 'EUR',
  isEditable,
  externalTaxProvider,
  isTaxStale,
  onUpdateLine,
  onUpdateLineFields,
}: TaxCellProps) {
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  const isExternalTax = Boolean(externalTaxProvider && externalTaxProvider !== 'internal');

  if (isExternalTax) {
    if (isTaxStale) {
      return (
        <span
          className="badge badge-warning text-xs font-normal"
          title={tSales('taxNeedsToBeCalculated', { provider: externalTaxProvider || '' })}
        >
          {tCommon('pending')}
        </span>
      );
    }
    return (
      <span
        title={`Calculated by ${externalTaxProvider}`}
        className="cursor-help border-b border-dotted border-[var(--text-muted)] text-xs"
      >
        {formatAmount(parseFloat(String(line.tax || '0')), currencyCode)}
      </span>
    );
  }

  const selectedCat = taxCategories.find((c) => c.taxCategoryId === line.taxCategoryId);
  const formattedPct = selectedCat
    ? (() => {
        const pct = parseFloat(String(selectedCat.rate || '0'));
        return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toString()}%`;
      })()
    : line.taxRate !== undefined
    ? `${line.taxRate % 1 === 0 ? line.taxRate.toFixed(0) : line.taxRate.toString()}%`
    : (() => {
        const amt = parseFloat(String(line.amount || '0'));
        const tax = parseFloat(String(line.tax || '0'));
        if (amt > 0 && tax > 0) {
          const pct = (tax / amt) * 100;
          return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
        }
        if (amt > 0 && tax === 0) return '0%';
        return '—';
      })();

  if (isEditable) {
    return (
      <div className="relative w-full">
        <div className="input w-full !text-xs text-right h-7 !px-1.5 py-1 flex items-center justify-end pointer-events-none">
          <span className="tabular-nums">{formattedPct}</span>
        </div>
        <select
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          value={line.taxCategoryId || ''}
          onChange={(e) => {
            const newCatId = e.target.value;
            const cat = taxCategories.find((c) => c.taxCategoryId === newCatId);
            const effectiveRate = cat ? parseFloat(String(cat.rate || '0')) : 0;

            if (onUpdateLineFields && line.taxRate !== undefined) {
              onUpdateLineFields(lineIdentifier, {
                taxCategoryId: newCatId,
                taxRate: effectiveRate,
              });
            } else {
              onUpdateLine?.(lineIdentifier, 'taxCategoryId', newCatId);
            }
          }}
          title={selectedCat ? getTaxLabel(selectedCat) : 'Tax Category'}
        >
          {taxCategories.map((c) => (
            <option key={c.taxCategoryId} value={c.taxCategoryId}>
              {getTaxLabel(c)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <span
      className="text-xs tabular-nums"
      title={selectedCat ? `Tax Category: ${selectedCat.title || selectedCat.code}` : undefined}
    >
      {formattedPct}
    </span>
  );
}
