'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { routes } from '@/lib/routes';
import type { ValidState } from '@/types/states';

interface CreditNoteDetailLine {
  creditNoteLineId?: string;
  salesOrderLineId?: string | null;
  productNumber?: string | null;
  description?: string | null;
  quantityCredited?: number | string | null;
  pricePerUnit?: number | string | null;
  discountPercentage?: number | string | null;
  returnFee?: number | string | null;
  amount: number | string;
}

interface CreditNoteDetailData {
  creditNoteId: string;
  creditNoteNumber: string;
  salesOrderId?: string | null;
  orderNumber?: string | null;
  returnId?: string | null;
  returnNumber?: string | null;
  customerId?: string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  createdOn: string;
  notes?: string | null;
  totalAmount: number | string;
  taxAmount?: number | string | null;
  feeAmount?: number | string | null;
  outstandingAmount?: number | string | null;
  currencyCode?: string | null;
  stateCode: string;
  lines?: CreditNoteDetailLine[];
}

export default function CreditNoteDetailContent({ id }: { id: string }) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CreditNoteDetailData | null>(null);

  const fetchCreditNote = useCallback(() => {
    setLoading(true);
    api.salesCreditNotesControllerFindOne(id)
      .then((res) => {
        setData(res.data as unknown as CreditNoteDetailData);
      })
      .catch((err) => reportError(err, 'CreditNoteDetailContent'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  useDocumentTitle(data ? `Credit Note ${data.creditNoteNumber}` : 'Credit Note Details');

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return tCommon('na');
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (loading) {
    return <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">{tCommon('noData')}</div>;
  }

  const currency = data.currencyCode || baseCurrency || 'USD';
  const lines = data.lines || [];
  const subtotal = parseFloat(data.totalAmount?.toString() || '0');
  const taxAmount = parseFloat(data.taxAmount?.toString() || '0');
  const feeAmount = parseFloat(data.feeAmount?.toString() || '0');
  const totalCredit = subtotal + taxAmount - feeAmount;

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={data.creditNoteNumber}
          subtitle={`${formatLocalDate(data.createdOn)} · Sales Credit Note`}
          badges={data.stateCode ? <StateBadge state={data.stateCode as ValidState} /> : undefined}
          actions={
            <Link
              href={routes.salesCreditNotes.list()}
              className="btn btn-secondary btn-sm"
            >
              ← Back to List
            </Link>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Overview & Source Documents Card */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Overview
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Customer
              </span>
              {data.customerId ? (
                <Link
                  href={routes.customers.detail(data.customerId)}
                  className="text-[var(--accent)] hover:underline font-semibold"
                >
                  {data.customerName || data.customerNumber
                    ? `${data.customerNumber ? `${data.customerNumber} - ` : ''}${data.customerName || ''}`
                    : `Customer ${data.customerId.substring(0, 8)}`}
                </Link>
              ) : (
                <span className="font-semibold text-[#041627]">
                  {data.customerNumber ? `${data.customerNumber} - ` : ''}
                  {data.customerName || tCommon('na')}
                </span>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Sales Order
              </span>
              {data.salesOrderId ? (
                <Link
                  href={routes.salesOrders.detail(data.salesOrderId)}
                  className="text-[var(--accent)] hover:underline font-semibold"
                >
                  {data.orderNumber || data.salesOrderId.substring(0, 8)}
                </Link>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Sales Return
              </span>
              {data.returnId ? (
                <Link
                  href={routes.salesReturns.detail(data.returnId)}
                  className="text-[var(--accent)] hover:underline font-semibold"
                >
                  {data.returnNumber || `Return ${data.returnId.substring(0, 8)}`}
                </Link>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Date Issued
              </span>
              <span className="font-semibold">{formatLocalDate(data.createdOn)}</span>
            </div>
          </div>

          {data.notes && (
            <div className="pt-3 border-t border-[var(--border)]">
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Memo / Notes
              </span>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Financial Breakdown */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Financial Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Subtotal</div>
              <div className="text-lg font-bold">{formatAmount(subtotal, currency)}</div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Total Tax</div>
              <div className="text-lg font-bold">{formatAmount(taxAmount, currency)}</div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Total Fees</div>
              <div className="text-lg font-bold text-[var(--text-danger)]">
                {feeAmount > 0 ? `-${formatAmount(feeAmount, currency)}` : '—'}
              </div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Net Credit Total</div>
              <div className="text-lg font-bold text-[var(--accent)]">
                {formatAmount(totalCredit, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Item / Description</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-right">Discount</th>
                <th className="px-5 py-3 text-right">Net Price</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3 text-right">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l, index) => {
                const qty = l.quantityCredited ? parseFloat(l.quantityCredited.toString()) : null;
                const grossPrice = l.pricePerUnit ? parseFloat(l.pricePerUnit.toString()) : null;
                const disc = l.discountPercentage ? parseFloat(l.discountPercentage.toString()) : 0;
                const netPrice = grossPrice !== null ? grossPrice * (1 - disc / 100) : null;
                const fee = l.returnFee ? parseFloat(l.returnFee.toString()) : 0;
                const lineTitle = l.description || (l.productNumber ? `Product ${l.productNumber}` : '—');

                return (
                  <tr key={l.creditNoteLineId || index} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      {l.productNumber && (
                        <div className="font-mono text-xs text-gray-500">{l.productNumber}</div>
                      )}
                      <div className="font-semibold text-[#041627] mt-0.5">
                        {lineTitle}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-gray-700">
                      {qty !== null && !isNaN(qty) ? qty : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-gray-700">
                      {grossPrice !== null && !isNaN(grossPrice) ? fmt(grossPrice) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-gray-700">
                      {disc > 0 ? `${disc}%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-gray-700">
                      {netPrice !== null && !isNaN(netPrice) ? fmt(netPrice) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs">
                      {fee > 0 ? (
                        <span className="text-[var(--text-danger)] font-medium">-{fmt(fee)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium text-[#041627]">
                      {fmt(l.amount)}
                    </td>
                  </tr>
                );
              })}
              {lines.length > 0 && (
                <>
                  <tr className="bg-[#f8f9fa] border-t-2 border-gray-200">
                    <td colSpan={6} className="px-5 py-2.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      Subtotal
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono font-semibold text-gray-900 text-xs">
                      {fmt(subtotal)}
                    </td>
                  </tr>
                  {taxAmount > 0 && (
                    <tr className="bg-[#f8f9fa]">
                      <td colSpan={6} className="px-5 py-2 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Total Tax
                      </td>
                      <td className="px-5 py-2 text-right font-mono font-semibold text-gray-900 text-xs">
                        {fmt(taxAmount)}
                      </td>
                    </tr>
                  )}
                  {feeAmount > 0 && (
                    <tr className="bg-[#f8f9fa]">
                      <td colSpan={6} className="px-5 py-2 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Total Fees
                      </td>
                      <td className="px-5 py-2 text-right font-mono font-semibold text-[var(--text-danger)] text-xs">
                        -{fmt(feeAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-[#f8f9fa] border-t border-gray-300">
                    <td colSpan={6} className="px-5 py-3 text-right font-bold text-[#041627] text-xs uppercase tracking-wider">
                      Net Credit
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-sm text-[#041627]">
                      {fmt(totalCredit)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {lines.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No credit note lines found
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
