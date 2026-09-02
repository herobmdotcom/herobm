'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
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
  events?: TimelineEvent[];
}

export default function CreditNoteDetailContent({ id }: { id: string }) {
  const tCommon = useTranslations('common');
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

  const lineColumns: DataTableColumn<CreditNoteDetailLine>[] = [
    {
      id: 'index',
      header: '#',
      width: 40,
      render: (_, i) => <span className="text-[var(--text-muted)]">{i + 1}</span>,
    },
    {
      id: 'product',
      header: 'Product',
      width: 140,
      render: (line) => (
        <span className="font-semibold text-[var(--accent)]">
          {line.productNumber || '—'}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      render: (line) => line.description || '—',
    },
    {
      id: 'qty',
      header: 'Qty',
      width: 90,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {parseFloat(line.quantityCredited?.toString() || '0')}
        </span>
      ),
    },
    {
      id: 'price',
      header: 'Price',
      width: 110,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {formatAmount(parseFloat(line.pricePerUnit?.toString() || '0'), currency)}
        </span>
      ),
    },
    {
      id: 'discount',
      header: 'Discount',
      width: 90,
      align: 'right',
      render: (line) => {
        const disc = line.discountPercentage ? parseFloat(line.discountPercentage.toString()) : 0;
        return disc > 0 ? `${disc}%` : '—';
      },
    },
    {
      id: 'fee',
      header: 'Fee',
      width: 100,
      align: 'right',
      render: (line) => {
        const fee = line.returnFee ? parseFloat(line.returnFee.toString()) : 0;
        return fee > 0 ? (
          <span className="text-[var(--text-danger)] font-medium tabular-nums">
            -{formatAmount(fee, currency)}
          </span>
        ) : '—';
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      width: 120,
      align: 'right',
      render: (line) => (
        <span className="font-semibold tabular-nums">
          {formatAmount(parseFloat(line.amount?.toString() || '0'), currency)}
        </span>
      ),
    },
  ];

  const linesFooter = (
    <>
      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
        <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          Subtotal
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(subtotal, currency)}
        </td>
      </tr>
      {taxAmount > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Tax
          </td>
          <td className="text-right tabular-nums font-semibold">
            {formatAmount(taxAmount, currency)}
          </td>
        </tr>
      )}
      {feeAmount > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Fees
          </td>
          <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
            -{formatAmount(feeAmount, currency)}
          </td>
        </tr>
      )}
      <tr className="hidden lg:table-row">
        <td colSpan={7} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          Net Credit Total
        </td>
        <td className="text-right tabular-nums font-bold text-sm text-[var(--accent)]">
          {formatAmount(totalCredit, currency)}
        </td>
      </tr>
    </>
  );

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={data.creditNoteNumber}
          subtitle={`${formatLocalDate(data.createdOn)} · Sales Credit Note`}
          badges={data.stateCode ? <StateBadge state={data.stateCode as ValidState} /> : undefined}
        />
      }
    >
      <div className="space-y-6">
        {/* Overview & Source Documents Card */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">info</span>
            <span>Overview</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Customer
              </span>
              {data.customerId ? (
                <Link
                  href={routes.customers.detail(data.customerId)}
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  {data.customerName || data.customerNumber
                    ? `${data.customerNumber ? `${data.customerNumber} - ` : ''}${data.customerName || ''}`
                    : `Customer ${data.customerId.substring(0, 8)}`}
                </Link>
              ) : (
                <span className="text-[var(--text-primary)]">
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
                  className="text-[var(--accent)] hover:underline font-medium"
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
                  className="text-[var(--accent)] hover:underline font-medium"
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
              <span className="text-sm">{formatLocalDate(data.createdOn)}</span>
            </div>
          </div>

          {data.notes && (
            <div className="pt-3 mt-4 border-t border-[var(--border)]">
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Memo / Notes
              </span>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">receipt_long</span>
            <span>Credit Note Lines ({lines.length})</span>
          </h3>
          <DataTable
            columns={lineColumns}
            data={lines}
            keyExtractor={(l, i) => l.creditNoteLineId || `line-${i}`}
            footer={linesFooter}
            mobileCard={(l, idx) => {
              const qty = l.quantityCredited ? parseFloat(l.quantityCredited.toString()) : 0;
              const price = l.pricePerUnit ? parseFloat(l.pricePerUnit.toString()) : 0;
              return (
                <MobileLineItemCard
                  title={l.productNumber || l.description || '—'}
                  subtitle={l.productNumber && l.description ? l.description : undefined}
                  topRightBadge={`#${idx + 1}`}
                  details={[
                    { label: 'Qty Credited', value: qty },
                    { label: 'Unit Price', value: formatAmount(price, currency) },
                    { label: 'Amount', value: formatAmount(parseFloat(l.amount?.toString() || '0'), currency) },
                  ]}
                />
              );
            }}
          />
        </div>

        {/* Activity Timeline Card */}
        <div id="timeline-section" className="card">
          <ActivityTimeline events={data.events || []} />
        </div>
      </div>
    </DetailsLayout>
  );
}
