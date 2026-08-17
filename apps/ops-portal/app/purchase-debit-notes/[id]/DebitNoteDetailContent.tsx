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
import { routes } from '@/lib/routes';
import type { ValidState } from '@/types/states';

interface DebitNoteDetailLine {
  debitNoteLineId: string;
  purchaseOrderLineId: string;
  quantityInvoiced: string;
  pricePerUnit: string;
  amount: string;
  taxAmount?: string | null;
  productNumber?: string | null;
  productDescription?: string | null;
}

interface DebitNoteDetailData {
  debitNoteId: string;
  debitNoteNumber: string;
  supplierReferenceNumber?: string | null;
  purchaseOrderId?: string | null;
  orderNumber?: string | null;
  returnId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  createdOn: string;
  notes?: string | null;
  totalAmount: number | string;
  taxAmount?: number | string | null;
  feeAmount?: number | string | null;
  outstandingAmount?: number | string | null;
  currencyCode?: string | null;
  stateCode: string;
  lines?: DebitNoteDetailLine[];
}

export default function DebitNoteDetailContent({ id }: { id: string }) {
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DebitNoteDetailData | null>(null);

  const fetchDebitNote = useCallback(() => {
    setLoading(true);
    (api as unknown as { purchaseDebitNotesControllerFindOne: (id: string) => Promise<{ data: unknown }> })
      .purchaseDebitNotesControllerFindOne(id)
      .then((res) => {
        setData(res.data as DebitNoteDetailData);
      })
      .catch((err) => reportError(err, 'DebitNoteDetailContent.fetch'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchDebitNote();
  }, [fetchDebitNote]);

  useDocumentTitle(data ? `Debit Note ${data.debitNoteNumber}` : 'Debit Note Details');

  if (loading) {
    return <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">{tCommon('noData')}</div>;
  }

  const currency = data.currencyCode || baseCurrency || 'USD';
  const totalAmount = parseFloat(data.totalAmount?.toString() || '0');
  const taxAmount = parseFloat(data.taxAmount?.toString() || '0');
  const feeAmount = parseFloat(data.feeAmount?.toString() || '0');
  const lines = data.lines || [];

  const lineColumns: DataTableColumn<DebitNoteDetailLine>[] = [
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
      render: (line) => line.productDescription || '—',
    },
    {
      id: 'qty',
      header: 'Qty Credited',
      width: 100,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {parseFloat(line.quantityInvoiced || '0')}
        </span>
      ),
    },
    {
      id: 'unitPrice',
      header: 'Unit Price',
      width: 110,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {formatAmount(parseFloat(line.pricePerUnit || '0'), currency)}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      width: 120,
      align: 'right',
      render: (line) => (
        <span className="font-semibold tabular-nums">
          {formatAmount(parseFloat(line.amount || '0'), currency)}
        </span>
      ),
    },
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={data.debitNoteNumber}
          subtitle={`${formatLocalDate(data.createdOn)} · Purchase Debit Note`}
          badges={data.stateCode ? <StateBadge state={data.stateCode as ValidState} /> : undefined}
          actions={
            <Link
              href={routes.purchaseDebitNotes.list()}
              className="btn btn-secondary btn-sm"
            >
              ← Back to List
            </Link>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Overview Card */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Overview
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier</span>
              {data.vendorId ? (
                <Link href={routes.suppliers.detail(data.vendorId)} className="text-[var(--accent)] hover:underline font-semibold">
                  {data.vendorName || '—'}
                </Link>
              ) : (
                <span className="font-semibold">{data.vendorName || '—'}</span>
              )}
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Purchase Order</span>
              {data.purchaseOrderId ? (
                <Link href={routes.purchaseOrders.detail(data.purchaseOrderId)} className="text-[var(--accent)] hover:underline font-semibold">
                  {data.orderNumber || '—'}
                </Link>
              ) : (
                <span className="font-semibold">{data.orderNumber || '—'}</span>
              )}
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier Ref #</span>
              <span className="font-semibold">{data.supplierReferenceNumber || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Created Date</span>
              <span className="font-semibold">{formatLocalDate(data.createdOn)}</span>
            </div>
          </div>

          {data.notes && (
            <div className="pt-3 border-t border-[var(--border)]">
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes</span>
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
              <div className="text-lg font-bold">{formatAmount(totalAmount, currency)}</div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Tax Amount</div>
              <div className="text-lg font-bold">{formatAmount(taxAmount, currency)}</div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Fees</div>
              <div className="text-lg font-bold text-[var(--text-danger)]">
                {feeAmount > 0 ? `-${formatAmount(feeAmount, currency)}` : '—'}
              </div>
            </div>
            <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Net Debit Total</div>
              <div className="text-lg font-bold text-[var(--accent)]">
                {formatAmount(totalAmount + taxAmount - feeAmount, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Debit Note Lines ({lines.length})
          </h4>
          <DataTable
            columns={lineColumns}
            data={lines}
            keyExtractor={(l) => l.debitNoteLineId}
          />
        </div>
      </div>
    </DetailsLayout>
  );
}
