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
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';
import EmailDocumentDialog from '@/components/shared/EmailDocumentDialog';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';

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
  events?: TimelineEvent[];
}

export default function DebitNoteDetailContent({ id }: { id: string }) {
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DebitNoteDetailData | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailDialogMode, setEmailDialogMode] = useState<'email' | 'print'>('email');

  const handleGenerateDebitNotePdf = async (customPdfText?: string) => {
    if (!data) return;
    try {
      const response = await api.pdfTemplatesControllerRunHook(
        'purchase-debit-note',
        { customPdfText },
        {
          id: data.debitNoteId,
          context: DATA_SOURCE_CONTEXT.PURCHASE_DEBIT_NOTE,
        },
      );
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      reportError(err, 'DebitNoteDetailContent:generatePdf');
      toast.error('Failed to generate Debit Note PDF');
    }
  };

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

  useDocumentTitle(
    data
      ? data.vendorName
        ? `${data.debitNoteNumber} - ${data.vendorName}`
        : data.debitNoteNumber
      : null,
  );

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
  const netDebitTotal = totalAmount + taxAmount - feeAmount;
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
      width: 110,
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

  const linesFooter = (
    <>
      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
        <td colSpan={5} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          Subtotal
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(totalAmount, currency)}
        </td>
      </tr>
      {taxAmount > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={5} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Tax
          </td>
          <td className="text-right tabular-nums font-semibold">
            {formatAmount(taxAmount, currency)}
          </td>
        </tr>
      )}
      {feeAmount > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={5} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Fees
          </td>
          <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
            -{formatAmount(feeAmount, currency)}
          </td>
        </tr>
      )}
      <tr className="hidden lg:table-row">
        <td colSpan={5} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          Net Debit Total
        </td>
        <td className="text-right tabular-nums font-bold text-sm text-[var(--accent)]">
          {formatAmount(netDebitTotal, currency)}
        </td>
      </tr>
    </>
  );

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={data.debitNoteNumber}
          subtitle={`${formatLocalDate(data.createdOn)} · Purchase Debit Note`}
          badges={data.stateCode ? <StateBadge state={data.stateCode as ValidState} /> : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmailDialogMode('print');
                  setIsEmailDialogOpen(true);
                }}
              >
                Print Debit Note
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmailDialogMode('email');
                  setIsEmailDialogOpen(true);
                }}
              >
                Email Debit Note
              </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Overview Card */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">info</span>
            <span>Overview</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier</span>
              {data.vendorId ? (
                <Link href={routes.suppliers.detail(data.vendorId)} className="text-[var(--accent)] hover:underline font-medium">
                  {data.vendorName || '—'}
                </Link>
              ) : (
                <span>{data.vendorName || '—'}</span>
              )}
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Purchase Order</span>
              {data.purchaseOrderId ? (
                <Link href={routes.purchaseOrders.detail(data.purchaseOrderId)} className="text-[var(--accent)] hover:underline font-medium">
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
            <div className="pt-3 mt-4 border-t border-[var(--border)]">
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes</span>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">receipt_long</span>
            <span>Debit Note Lines ({lines.length})</span>
          </h3>
          <DataTable
            columns={lineColumns}
            data={lines}
            keyExtractor={(l, i) => l.debitNoteLineId || `line-${i}`}
            footer={linesFooter}
            mobileCard={(line, idx) => (
              <MobileLineItemCard
                title={line.productNumber || '—'}
                subtitle={line.productDescription || '—'}
                topRightBadge={`#${idx + 1}`}
                details={[
                  { label: 'Qty Credited', value: parseFloat(line.quantityInvoiced || '0') },
                  { label: 'Unit Price', value: formatAmount(parseFloat(line.pricePerUnit || '0'), currency) },
                  { label: 'Amount', value: formatAmount(parseFloat(line.amount || '0'), currency) },
                ]}
              />
            )}
          />
        </div>

        {/* Activity Timeline Card */}
        <div id="timeline-section" className="card">
          <ActivityTimeline events={data.events || []} />
        </div>
      </div>

      {data && (
        <EmailDocumentDialog
          isOpen={isEmailDialogOpen}
          mode={emailDialogMode}
          orderId={data.debitNoteId}
          orderNumber={data.debitNoteNumber}
          customerReference={data.orderNumber}
          supplierId={data.vendorId || undefined}
          hookSlug="purchase-debit-note"
          title={emailDialogMode === 'print' ? 'Print Purchase Debit Note' : 'Email Purchase Debit Note'}
          defaultSubjectPrefix="Debit Note"
          documentName="Debit Note"
          targetId={data.debitNoteId}
          contextSlug={DATA_SOURCE_CONTEXT.PURCHASE_DEBIT_NOTE}
          onClose={() => setIsEmailDialogOpen(false)}
          onSuccess={() => {
            setIsEmailDialogOpen(false);
            if (emailDialogMode !== 'print') {
              toast.success('Email queued successfully!');
            }
            fetchDebitNote();
          }}
          onPreview={(customText) => handleGenerateDebitNotePdf(customText)}
        />
      )}
    </DetailsLayout>
  );
}
