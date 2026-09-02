'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatAmount } from '@/lib/currency';

interface OrderLinesFooterProps {
  subtotal: number;
  totalTax: number;
  totalDiscount?: number;
  grandTotal?: number;
  currencyCode?: string;
  colSpan?: number;
  hasActionColumn?: boolean;
  externalTaxProvider?: string | null;
  isTaxStale?: boolean;
}

export function OrderLinesFooter({
  subtotal,
  totalTax,
  totalDiscount = 0,
  grandTotal,
  currencyCode = 'EUR',
  colSpan = 8,
  hasActionColumn = false,
  externalTaxProvider,
  isTaxStale,
}: OrderLinesFooterProps) {
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  const isExternalTax = Boolean(externalTaxProvider && externalTaxProvider !== 'internal');
  const taxPct = subtotal > 0 && !isTaxStale ? (totalTax / subtotal) * 100 : 0;
  const effectiveGrandTotal =
    grandTotal !== undefined ? grandTotal : subtotal + totalTax - totalDiscount;

  return (
    <>
      {/* Desktop Rows */}
      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
        <td colSpan={colSpan} className="text-right font-semibold text-[var(--text-muted)]">
          {tCommon('subtotal')}
        </td>
        <td className="text-right font-semibold tabular-nums">
          {formatAmount(subtotal, currencyCode)}
        </td>
        {hasActionColumn && <td></td>}
      </tr>

      {totalDiscount > 0 && (
        <tr className="hidden lg:table-row text-emerald-600">
          <td colSpan={colSpan} className="text-right font-semibold">
            {tSales('columns.discountPct')}
          </td>
          <td className="text-right font-semibold tabular-nums">
            -{formatAmount(totalDiscount, currencyCode)}
          </td>
          {hasActionColumn && <td></td>}
        </tr>
      )}

      <tr className="hidden lg:table-row">
        <td colSpan={colSpan} className="text-right font-semibold text-[var(--text-muted)]">
          {tCommon('tax')}
          {taxPct > 0 && !isTaxStale
            ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)`
            : ''}
        </td>
        <td className="text-right font-semibold tabular-nums">
          {isTaxStale ? (
            <span className="badge badge-warning text-xs font-normal ml-auto">
              {tCommon('pending')}
            </span>
          ) : (
            formatAmount(totalTax, currencyCode)
          )}
        </td>
        {hasActionColumn && <td></td>}
      </tr>

      <tr className="hidden lg:table-row bg-blue-500/[0.02]">
        <td colSpan={colSpan} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          {tCommon('total')}
        </td>
        <td className="text-right font-extrabold text-sm text-[var(--accent)] tabular-nums">
          {isTaxStale ? (
            <span className="badge badge-warning text-xs font-normal ml-auto">
              {tCommon('pending')}
            </span>
          ) : (
            formatAmount(effectiveGrandTotal, currencyCode)
          )}
        </td>
        {hasActionColumn && <td></td>}
      </tr>

      {/* Mobile Rows */}
      <tr className="lg:hidden">
        <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">
          {tCommon('subtotal')}
        </td>
        <td className="py-1 text-sm font-semibold text-right tabular-nums">
          {formatAmount(subtotal, currencyCode)}
        </td>
      </tr>

      {totalDiscount > 0 && (
        <tr className="lg:hidden text-emerald-600">
          <td className="py-1 text-xs font-medium text-right pr-4">
            {tSales('columns.discountPct')}
          </td>
          <td className="py-1 text-sm font-semibold text-right tabular-nums">
            -{formatAmount(totalDiscount, currencyCode)}
          </td>
        </tr>
      )}

      <tr className="lg:hidden">
        <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">
          {tCommon('tax')}
        </td>
        <td className="py-1 text-sm font-semibold text-right tabular-nums">
          {isTaxStale ? (
            <span className="badge badge-warning text-[10px] font-normal inline-block">
              {tCommon('pending')}
            </span>
          ) : (
            formatAmount(totalTax, currencyCode)
          )}
        </td>
      </tr>

      <tr className="lg:hidden">
        <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">
          {tCommon('total')}
        </td>
        <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">
          {isTaxStale ? (
            <span className="badge badge-warning text-[10px] font-normal inline-block">
              {tCommon('pending')}
            </span>
          ) : (
            formatAmount(effectiveGrandTotal, currencyCode)
          )}
        </td>
      </tr>
    </>
  );
}
