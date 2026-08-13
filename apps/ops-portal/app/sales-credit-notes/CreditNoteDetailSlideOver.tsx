'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';

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

export default function CreditNoteDetailSlideOver({
  isOpen,
  onClose,
  creditNoteId,
}: {
  isOpen: boolean;
  onClose: () => void;
  creditNoteId: string | null;
}) {
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CreditNoteDetailData | null>(null);

  useEffect(() => {
    if (isOpen && creditNoteId) {
      setLoading(true);
      api.salesCreditNotesControllerFindOne(creditNoteId)
        .then((res) => {
          setData(res.data as unknown as CreditNoteDetailData);
        })
        .catch((err) => reportError(err, 'CreditNoteDetailSlideOver'))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [isOpen, creditNoteId]);

  if (!isOpen || !creditNoteId) return null;

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return tCommon('na');
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const currency = data?.currencyCode || baseCurrency || 'USD';
  const totalAmount = data ? parseFloat(data.totalAmount?.toString() || '0') : 0;
  const taxAmount = data ? parseFloat(data.taxAmount?.toString() || '0') : 0;
  const feeAmount = data ? parseFloat(data.feeAmount?.toString() || '0') : 0;
  const netCredit = data ? parseFloat(data.outstandingAmount?.toString() || '0') : totalAmount + taxAmount - feeAmount;
  const lines = data?.lines || [];

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={data ? data.creditNoteNumber : 'Credit Note Details'}
      subtitle={data ? `${formatLocalDate(data.createdOn)} · Sales Credit Note` : undefined}
      width="max-w-4xl"
    >
      {data && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex flex-col gap-5 text-sm">
              <div>
                <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Memo
                </span>
                <span className="text-[#041627] whitespace-pre-wrap">
                  {data.notes || tCommon('na')}
                </span>
              </div>

              {(data.returnId || data.salesOrderId) && (
                <div>
                  <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    Source Document
                  </span>
                  <div className="flex items-center gap-3">
                    {data.returnId && (
                      <Link
                        href={`/sales-returns/${data.returnId}`}
                        className="text-[var(--accent)] hover:underline font-medium"
                        onClick={onClose}
                      >
                        {data.returnNumber || `Return ${data.returnId.substring(0, 8)}`}
                      </Link>
                    )}
                    {data.returnId && data.salesOrderId && (
                      <span className="text-gray-400">•</span>
                    )}
                    {data.salesOrderId && (
                      <Link
                        href={`/sales-orders/${data.salesOrderId}`}
                        className="text-[var(--accent)] hover:underline font-medium"
                        onClick={onClose}
                      >
                        {data.orderNumber || data.salesOrderId.substring(0, 8)}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {(data.customerName || data.customerNumber || data.customerId) && (
                <div>
                  <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    Customer
                  </span>
                  {data.customerId ? (
                    <Link
                      href={`/customers/${data.customerId}`}
                      className="text-[var(--accent)] hover:underline font-medium"
                      onClick={onClose}
                    >
                      {data.customerName || data.customerNumber
                        ? `${data.customerNumber ? `${data.customerNumber} - ` : ''}${data.customerName || ''}`
                        : `Customer ${data.customerId.substring(0, 8)}`}
                    </Link>
                  ) : (
                    <span className="text-[#041627]">
                      {data.customerNumber ? `${data.customerNumber} - ` : ''}
                      {data.customerName || tCommon('na')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner text-gray-400"></span>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">ITEM / DESCRIPTION</th>
                    <th className="px-5 py-3 text-right">QTY</th>
                    <th className="px-5 py-3 text-right">PRICE</th>
                    <th className="px-5 py-3 text-right">DISCOUNT</th>
                    <th className="px-5 py-3 text-right">NET PRICE</th>
                    <th className="px-5 py-3 text-right">FEE</th>
                    <th className="px-5 py-3 text-right">AMOUNT ({currency})</th>
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
                          TOTAL CREDIT
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono font-semibold text-gray-900 text-xs">
                          {fmt(totalAmount)}
                        </td>
                      </tr>
                      {taxAmount > 0 && (
                        <tr className="bg-[#f8f9fa]">
                          <td colSpan={6} className="px-5 py-2 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">
                            TOTAL TAX
                          </td>
                          <td className="px-5 py-2 text-right font-mono font-semibold text-gray-900 text-xs">
                            {fmt(taxAmount)}
                          </td>
                        </tr>
                      )}
                      {feeAmount > 0 && (
                        <tr className="bg-[#f8f9fa]">
                          <td colSpan={6} className="px-5 py-2 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">
                            TOTAL FEES
                          </td>
                          <td className="px-5 py-2 text-right font-mono font-semibold text-[var(--text-danger)] text-xs">
                            -{fmt(feeAmount)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-[#f8f9fa] border-t border-gray-300">
                        <td colSpan={6} className="px-5 py-3 text-right font-bold text-[#041627] text-xs uppercase tracking-wider">
                          NET CREDIT
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-sm text-[#041627]">
                          {fmt(netCredit)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}
            {!loading && lines.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No credit note lines found
              </div>
            )}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
