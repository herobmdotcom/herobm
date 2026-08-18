'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';

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

export default function DebitNoteDetailSlideOver({
  isOpen,
  onClose,
  debitNoteId,
}: {
  isOpen: boolean;
  onClose: () => void;
  debitNoteId: string | null;
}) {
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DebitNoteDetailData | null>(null);

  useEffect(() => {
    if (isOpen && debitNoteId) {
      setLoading(true);
      (api as unknown as { purchaseDebitNotesControllerFindOne: (id: string) => Promise<{ data: unknown }> })
        .purchaseDebitNotesControllerFindOne(debitNoteId)
        .then((res: { data: unknown }) => {
          setData(res.data as DebitNoteDetailData);
        })
        .catch((err: unknown) => reportError(err, 'DebitNoteDetailSlideOver.fetch'))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [isOpen, debitNoteId]);

  if (!isOpen || !debitNoteId) return null;

  const currency = data?.currencyCode || baseCurrency || 'AUD';
  const totalAmount = data ? parseFloat(data.totalAmount?.toString() || '0') : 0;
  const taxAmount = data ? parseFloat(data.taxAmount?.toString() || '0') : 0;
  const feeAmount = data ? parseFloat(data.feeAmount?.toString() || '0') : 0;
  const lines = data?.lines || [];

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
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={data ? data.debitNoteNumber : 'Debit Note Details'}
      subtitle={data ? `${formatLocalDate(data.createdOn)} · Purchase Debit Note` : undefined}
      width="max-w-4xl"
    >
      {loading ? (
        <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Overview
              </h4>
              <StateBadge state={data.stateCode as ValidState} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier</span>
                {data.vendorId ? (
                  <Link href={`/suppliers/${data.vendorId}`} className="text-[var(--accent)] hover:underline font-medium">
                    {data.vendorName || '—'}
                  </Link>
                ) : (
                  <span>{data.vendorName || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Purchase Order</span>
                {data.purchaseOrderId ? (
                  <Link href={`/purchase-orders/${data.purchaseOrderId}`} className="text-[var(--accent)] hover:underline font-medium">
                    {data.orderNumber || '—'}
                  </Link>
                ) : (
                  <span>{data.orderNumber || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier Ref #</span>
                <span>{data.supplierReferenceNumber || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Created Date</span>
                <span>{formatLocalDate(data.createdOn)}</span>
              </div>
            </div>

            {data.notes && (
              <div className="pt-3 border-t border-[var(--border)]">
                <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes</span>
                <p className="text-sm">{data.notes}</p>
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
      ) : null}
    </SlideOver>
  );
}
