'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage, computeReturnCreditSummary } from '@herobm/shared';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';

interface ReturnLine {
  returnLineId: string;
  purchaseOrderLineId: string;
  quantityReturned: string;
  reason?: string;
  returnFee?: string;
  sourceBinId?: string;
  sourceBinNumber?: string;
  productId?: string;
  productNumber?: string;
  productDescription?: string;
  pricePerUnit?: string;
  tax?: string;
}

interface PurchaseReturnDetails {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  purchaseOrderId: string;
  vendorName?: string;
  vendorId?: string;
  currencyCode?: string;
  lines: ReturnLine[];
}

export default function ReturnDebitNoteSlideOver({
  isOpen,
  onClose,
  returnRecord,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Flexible row schema from grid
  returnRecord: any | null;
  onSuccess: () => void;
}) {
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [fullReturn, setFullReturn] = useState<PurchaseReturnDetails | null>(null);

  // Form states
  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [feeAmount, setFeeAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // Fetch full details when opened
  useEffect(() => {
    if (isOpen && returnRecord?.returnId) {
      setNotes(`Debit note for return ${returnRecord.returnNumber}`);
      setSupplierReferenceNumber('');

      api.globalPurchaseReturnsControllerGetPurchaseReturnById(returnRecord.returnId)
        .then((res) => {
          const ret = res.data as unknown as PurchaseReturnDetails;
          setFullReturn(ret);

          // Calculate initial tax & fees from lines
          const summary = computeReturnCreditSummary(
            (ret.lines || []).map((l) => ({
              quantity: parseFloat(l.quantityReturned || '0'),
              pricePerUnit: parseFloat(l.pricePerUnit || '0'),
              returnFee: parseFloat(l.returnFee || '0'),
              taxRate:
                parseFloat(l.pricePerUnit || '0') > 0
                  ? (parseFloat(l.tax || '0') /
                      (parseFloat(l.quantityReturned || '1') * parseFloat(l.pricePerUnit || '1'))) *
                    100
                  : 0,
            })),
          );

          setTaxAmount(summary.totalTax.toFixed(2));
          setFeeAmount(summary.totalFees.toFixed(2));
        })
        .catch((err) => reportError(err, 'ReturnDebitNoteSlideOver.fetch'));
    } else {
      setFullReturn(null);
      setSupplierReferenceNumber('');
      setTaxAmount('0');
      setFeeAmount('0');
      setNotes('');
    }
  }, [isOpen, returnRecord]);

  const currency = fullReturn?.currencyCode || returnRecord?.currencyCode || 'AUD';

  const lines = fullReturn?.lines || [];

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantityReturned || '0');
      const price = parseFloat(line.pricePerUnit || '0');
      return sum + qty * price;
    }, 0);
  }, [lines]);

  const parsedTax = parseFloat(taxAmount || '0') || 0;
  const parsedFee = parseFloat(feeAmount || '0') || 0;
  const netTotal = Math.max(0, subtotal + parsedTax - parsedFee);

  const submitBtnText = saving ? tCommon('saving') : 'Confirm & Post Debit Note';

  if (!returnRecord) return null;

  const handleConfirm = async () => {
    if (!fullReturn) return;
    setSaving(true);
    try {
      const linesPayload = (fullReturn.lines || []).map((line) => {
        const price = parseFloat(line.pricePerUnit || '0');
        const qty = parseFloat(line.quantityReturned || '0');
        return {
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantityInvoiced: line.quantityReturned,
          pricePerUnit: price.toString(),
          amount: (qty * price).toFixed(2),
        };
      });

      const payload = {
        returnId: fullReturn.returnId,
        supplierReferenceNumber: supplierReferenceNumber || undefined,
        lines: linesPayload,
        taxAmount: parsedTax.toString(),
        feeAmount: parsedFee.toString(),
        notes: notes || undefined,
      };

      const res = await api.purchaseDebitNotesControllerCreateDebitNote(
        payload as unknown as Parameters<typeof api.purchaseDebitNotesControllerCreateDebitNote>[0],
      );

      const debitNoteId =
        (res.data as unknown as { debitNoteId?: string; id?: string }).debitNoteId ||
        (res.data as unknown as { debitNoteId?: string; id?: string }).id ||
        '';

      if (debitNoteId) {
        await api.purchaseDebitNotesControllerPostDebitNote(debitNoteId, {});
      }

      toast.success('Purchase Debit Note issued and posted successfully');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to issue Debit Note');
    } finally {
      setSaving(false);
    }
  };

  const lineColumns: DataTableColumn<ReturnLine>[] = [
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
          {line.productNumber || line.productId?.substring(0, 8) || '—'}
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
      header: 'Return Qty',
      width: 90,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {parseFloat(line.quantityReturned || '0')}
        </span>
      ),
    },
    {
      id: 'sourceBin',
      header: 'Source Bin',
      width: 100,
      render: (line) => (
        <span className="text-xs font-mono bg-[var(--bg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
          {line.sourceBinNumber || line.sourceBinId?.substring(0, 8) || '—'}
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
      render: (line) => {
        const qty = parseFloat(line.quantityReturned || '0');
        const price = parseFloat(line.pricePerUnit || '0');
        return (
          <span className="font-semibold tabular-nums">
            {formatAmount(qty * price, currency)}
          </span>
        );
      },
    },
  ];

  const linesFooter = (
    <>
      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
        <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          Subtotal
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(subtotal, currency)}
        </td>
      </tr>
      {parsedTax > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Tax
          </td>
          <td className="text-right tabular-nums font-semibold">
            {formatAmount(parsedTax, currency)}
          </td>
        </tr>
      )}
      {parsedFee > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Restocking / Return Fees
          </td>
          <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
            -{formatAmount(parsedFee, currency)}
          </td>
        </tr>
      )}
      <tr className="hidden lg:table-row">
        <td colSpan={6} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          Net Debit Total
        </td>
        <td className="text-right tabular-nums font-bold text-[14px]">
          {formatAmount(netTotal, currency)}
        </td>
      </tr>
    </>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Create Purchase Debit Note"
      subtitle={`Return: ${returnRecord.returnNumber} · ${returnRecord.vendorName || ''}`}
      width="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Return Summary Header */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Supplier & Order Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Supplier</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {fullReturn?.vendorName || returnRecord.vendorName || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Purchase Order</span>
              {fullReturn?.purchaseOrderId ? (
                <Link
                  href={`/purchase-orders/${fullReturn.purchaseOrderId}`}
                  className="text-[var(--accent)] hover:underline font-semibold"
                >
                  {fullReturn.orderNumber || returnRecord.orderNumber || '—'}
                </Link>
              ) : (
                <span className="font-semibold">{returnRecord.orderNumber || '—'}</span>
              )}
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Return Reference</span>
              <span className="font-semibold">{returnRecord.returnNumber}</span>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Debit Note Parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Supplier Reference Number
              </label>
              <input
                type="text"
                className="input w-full"
                value={supplierReferenceNumber}
                onChange={(e) => setSupplierReferenceNumber(e.target.value)}
                placeholder="e.g. CRN-2026-001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Tax Amount
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Restocking / Return Fee
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Notes
              </label>
              <input
                type="text"
                className="input w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional memo for this debit note..."
              />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="card space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Returned Items ({lines.length})
          </h4>
          <DataTable
            columns={lineColumns}
            data={lines}
            keyExtractor={(l) => l.returnLineId}
            footer={linesFooter}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={saving}>
            {submitBtnText}
          </Button>
        </div>
      </div>
    </SlideOver>
  );
}
