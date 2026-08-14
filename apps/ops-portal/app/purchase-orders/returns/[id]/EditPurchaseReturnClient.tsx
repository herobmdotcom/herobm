'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import InlineAlert from '@/components/shared/InlineAlert';
import StateBadge from '@/components/StateBadge';
import SlideOver from '@/components/shared/SlideOver';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import type { ValidState } from '@/types/states';
import { Button } from '@/components/shared/Button';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import * as api from '@herobm/sdk';
import { PURCHASE_RETURN_STATE, getErrorMessage, computeReturnCreditSummary } from '@herobm/shared';
import { reportError } from '@/lib/api';

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

interface ReturnShipment {
  shipmentId: string;
  shipmentNumber: string;
  stateCode: string;
  trackingNumber?: string | null;
  notes?: string | null;
  dispatchedOn?: string | null;
}

interface ReturnDetails {
  returnId: string;
  returnNumber: string;
  packingSlipNumber?: string | null;
  stateCode: string;
  createdOn: string;
  notes?: string | null;
  orderNumber?: string;
  purchaseOrderId: string;
  vendorName?: string;
  vendorId?: string;
  currencyCode?: string;
  debitNoteId?: string;
  debitNoteNumber?: string;
  debitNoteState?: string;
  debitNoteTotalAmount?: string;
  debitNotes?: Array<{
    debitNoteId?: string;
    debitNoteNumber?: string;
    stateCode?: string;
    totalAmount?: string;
    createdOn?: string;
  }>;
  events?: TimelineEvent[];
  shipments?: ReturnShipment[];
  lines: ReturnLine[];
}

export default function EditPurchaseReturnClient({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');

  const [returnDetails, setReturnDetails] = useState<ReturnDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ship Return Modal State
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipTrackingNumber, setShipTrackingNumber] = useState('');
  const [shipNotes, setShipNotes] = useState('');

  useDocumentTitle(
    returnDetails ? `Return ${returnDetails.returnNumber}` : 'Return Details',
  );

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await api.globalPurchaseReturnsControllerGetPurchaseReturnById(id);
      setReturnDetails(res.data as ReturnDetails);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleStageReturn = async () => {
    if (!returnDetails) return;
    try {
      setSubmitting(true);
      await api.purchaseReturnsControllerStageReturn(returnDetails.purchaseOrderId, id, {});
      await fetchDetails();
    } catch (err) {
      alert(getErrorMessage(err) || 'Failed to stage return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShipReturnConfirm = async () => {
    if (!returnDetails) return;
    try {
      setSubmitting(true);
      await api.purchaseReturnsControllerShipReturn(
        returnDetails.purchaseOrderId,
        id,
        {
          trackingNumber: shipTrackingNumber || undefined,
          notes: shipNotes || undefined,
        } as unknown as Parameters<typeof api.purchaseReturnsControllerShipReturn>[2],
      );
      setIsShipModalOpen(false);
      await fetchDetails();
    } catch (err) {
      alert(getErrorMessage(err) || 'Failed to ship return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnstageReturn = async () => {
    if (!returnDetails) return;
    try {
      setSubmitting(true);
      await (api as unknown as Record<string, (poId: string, returnId: string, body: unknown) => Promise<unknown>>).purchaseReturnsControllerUnstageReturn(returnDetails.purchaseOrderId, id, {});
      await fetchDetails();
    } catch (err) {
      alert(getErrorMessage(err) || 'Failed to unstage return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshipReturn = async () => {
    if (!returnDetails) return;
    if (!confirm('Are you sure you want to unship this return? Stock will be restored to staging.')) return;
    try {
      setSubmitting(true);
      await (api as unknown as Record<string, (poId: string, returnId: string, body: unknown) => Promise<unknown>>).purchaseReturnsControllerUnshipReturn(returnDetails.purchaseOrderId, id, {});
      await fetchDetails();
    } catch (err) {
      alert(getErrorMessage(err) || 'Failed to unship return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReturn = async () => {
    if (!returnDetails) return;
    if (!confirm('Are you sure you want to cancel this return?')) return;
    try {
      setSubmitting(true);
      await api.purchaseReturnsControllerCancelReturn(returnDetails.purchaseOrderId, id, {});
      await fetchDetails();
    } catch (err) {
      alert(getErrorMessage(err) || 'Failed to cancel return');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">{tCommon('loading')}</div>;
  if (!returnDetails)
    return <div className="p-6 text-red-600">{error || tCommon('noData')}</div>;

  const stateCodeLower = returnDetails.stateCode?.toLowerCase();
  const isDraft = stateCodeLower === PURCHASE_RETURN_STATE.DRAFT;
  const isStaged = stateCodeLower === PURCHASE_RETURN_STATE.STAGED;
  const isShipped = stateCodeLower === PURCHASE_RETURN_STATE.SHIPPED;

  const currency = returnDetails.currencyCode || 'AUD';
  const primaryShipment = returnDetails.shipments && returnDetails.shipments.length > 0
    ? returnDetails.shipments[0]
    : null;

  const shipSubmitLabel = submitting ? tCommon('saving') : 'Confirm & Ship Return';

  // Calculate totals using shared return credit boundary helper
  const {
    subtotal,
    totalTax,
    totalFees,
    netCredit: netTotal,
  } = computeReturnCreditSummary(
    returnDetails.lines.map((l) => ({
      quantity: parseFloat(l.quantityReturned || '0'),
      pricePerUnit: parseFloat(l.pricePerUnit || '0'),
      returnFee: parseFloat(l.returnFee || '0'),
      taxRate: parseFloat(l.pricePerUnit || '0') > 0 ? (parseFloat(l.tax || '0') / (parseFloat(l.quantityReturned || '1') * parseFloat(l.pricePerUnit || '1'))) * 100 : 0,
    })),
  );

  const lineColumns: DataTableColumn<ReturnLine>[] = [
    {
      id: 'index',
      header: '#',
      width: 40,
      render: (_, i) => <span className="text-[var(--text-muted)]">{i + 1}</span>,
    },
    {
      id: 'product',
      header: tPurchase('columns.product'),
      width: 150,
      render: (line) => (
        <span className="font-semibold text-[var(--accent)]">
          {line.productNumber || line.productId?.substring(0, 8) || '—'}
        </span>
      ),
    },
    {
      id: 'description',
      header: tPurchase('columns.description'),
      render: (line) => line.productDescription || '—',
    },
    {
      id: 'qty',
      header: tPurchase('columns.qtyReturned') || 'Return Qty',
      width: 90,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {parseFloat(line.quantityReturned || '0')}
        </span>
      ),
    },
    {
      id: 'reason',
      header: tPurchase('returns.reason') || 'Reason',
      width: 130,
      render: (line) => line.reason || '—',
    },
    {
      id: 'sourceBin',
      header: 'Source Bin',
      width: 120,
      render: (line) => (
        <span className="text-xs font-mono bg-[var(--bg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
          {line.sourceBinNumber || line.sourceBinId?.substring(0, 8) || '—'}
        </span>
      ),
    },
    {
      id: 'unitPrice',
      header: tPurchase('columns.unitPrice'),
      width: 120,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums">
          {formatAmount(parseFloat(line.pricePerUnit || '0'), currency)}
        </span>
      ),
    },
    {
      id: 'amount',
      header: tPurchase('columns.amount'),
      width: 130,
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
        <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          Subtotal
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(subtotal, currency)}
        </td>
      </tr>
      {totalTax > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Tax
          </td>
          <td className="text-right tabular-nums font-semibold">
            {formatAmount(totalTax, currency)}
          </td>
        </tr>
      )}
      {totalFees > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={7} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Restocking / Return Fees
          </td>
          <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
            -{formatAmount(totalFees, currency)}
          </td>
        </tr>
      )}
      <tr className="hidden lg:table-row">
        <td colSpan={7} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          Net Debit Total
        </td>
        <td className="text-right tabular-nums font-bold text-sm">
          {formatAmount(netTotal, currency)}
        </td>
      </tr>
    </>
  );

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={returnDetails.returnNumber}
          subtitle={`PO: ${returnDetails.orderNumber || ''} ${returnDetails.vendorName ? `• ${returnDetails.vendorName}` : ''}`}
          badges={<StateBadge state={returnDetails.stateCode as ValidState} />}
          actions={
            <div className="flex items-center gap-2">
              {isDraft && (
                <>
                  <Button variant="primary" size="sm" disabled={submitting} onClick={handleStageReturn}>
                    Stage Return
                  </Button>
                  <Button variant="danger" size="sm" disabled={submitting} onClick={handleCancelReturn}>
                    <span className="material-symbols-outlined mr-1 text-base">delete</span>
                    {tCommon('cancel')}
                  </Button>
                </>
              )}

              {isStaged && (
                <>
                  <Button variant="primary" size="sm" disabled={submitting} onClick={() => setIsShipModalOpen(true)}>
                    Ship Return
                  </Button>
                  <Button variant="secondary" size="sm" disabled={submitting} onClick={handleUnstageReturn}>
                    ← Return to Draft
                  </Button>
                  <Button variant="danger" size="sm" disabled={submitting} onClick={handleCancelReturn}>
                    <span className="material-symbols-outlined mr-1 text-base">delete</span>
                    {tCommon('cancel')}
                  </Button>
                </>
              )}

              {isShipped && (
                <>
                  <Button variant="secondary" size="sm" disabled={submitting} onClick={handleUnshipReturn}>
                    ← Return to Staged
                  </Button>
                </>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {error && <InlineAlert type="error" message={error} />}

        {/* Return Information Card */}
        <div id="summary-section" className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">info</span>
            <span>Return Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Purchase Order
              </label>
              <div className="text-sm">
                <Link
                  href={`/purchase-orders/${returnDetails.purchaseOrderId}`}
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  {returnDetails.orderNumber}
                </Link>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Supplier
              </label>
              <div className="text-sm">
                {returnDetails.vendorId ? (
                  <Link
                    href={`/suppliers/${returnDetails.vendorId}`}
                    className="text-[var(--accent)] hover:underline font-medium"
                  >
                    {returnDetails.vendorName}
                  </Link>
                ) : (
                  returnDetails.vendorName || '—'
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Created Date
              </label>
              <div className="text-sm">
                {formatLocalDate(returnDetails.createdOn)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Tracking Number
              </label>
              <div className="text-sm font-medium">
                {primaryShipment?.trackingNumber ? (
                  <span className="text-[var(--text-primary)]">{primaryShipment.trackingNumber}</span>
                ) : (
                  <span className="text-[var(--text-muted)]">Not specified</span>
                )}
              </div>
            </div>
          </div>

          {returnDetails.notes && (
            <div className="mt-6">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Return Notes
              </label>
              <div className="text-sm text-[var(--text-primary)]">
                {returnDetails.notes}
              </div>
            </div>
          )}
        </div>

        {/* Linked Debit Notes Section */}
        {((returnDetails.debitNotes && returnDetails.debitNotes.length > 0) || returnDetails.debitNoteNumber || isShipped) && (
          <div id="debit-notes-section" className="card">
            <h3 className="section-heading mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0">receipt_long</span>
              <span>Debit Notes</span>
            </h3>
            {((returnDetails.debitNotes && returnDetails.debitNotes.length > 0) || returnDetails.debitNoteNumber) ? (
              <div className="flex flex-col gap-2">
                {(returnDetails.debitNotes && returnDetails.debitNotes.length > 0
                  ? returnDetails.debitNotes
                  : [{
                      debitNoteId: returnDetails.debitNoteId,
                      debitNoteNumber: returnDetails.debitNoteNumber,
                      stateCode: returnDetails.debitNoteState,
                      totalAmount: returnDetails.debitNoteTotalAmount,
                    }]
                ).map((dn, idx) => (
                  <div key={dn.debitNoteId || idx} className="p-3 rounded-lg border border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--accent)] text-lg">receipt_long</span>
                      <div>
                        <div className="font-semibold text-sm text-[var(--text-primary)]">{dn.debitNoteNumber}</div>
                        {dn.createdOn && (
                          <div className="text-xs text-[var(--text-muted)]">{formatLocalDate(dn.createdOn)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {dn.totalAmount && (
                        <span className="font-semibold text-sm tabular-nums">
                          {formatAmount(parseFloat(dn.totalAmount), currency)}
                        </span>
                      )}
                      {dn.stateCode && <StateBadge state={dn.stateCode as ValidState} />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[var(--text-muted)] text-xl">hourglass_top</span>
                <span>Return has been shipped to supplier. Pending Debit Note reconciliation by Finance upon supplier document confirmation.</span>
              </div>
            )}
          </div>
        )}

        {/* Return Items Section */}
        <div id="lines-section" className="card">
          <h3 className="section-heading mb-4">
            <span className="material-symbols-outlined">assignment_return</span>
            Returned Items ({returnDetails.lines.length})
          </h3>

          <DataTable
            columns={lineColumns}
            data={returnDetails.lines}
            keyExtractor={(line) => line.returnLineId}
            footer={linesFooter}
            mobileCard={(line, idx) => (
              <MobileLineItemCard
                title={line.productNumber || '—'}
                subtitle={line.productDescription || '—'}
                topRightBadge={`#${idx + 1}`}
                details={[
                  { label: 'Return Qty', value: parseFloat(line.quantityReturned || '0') },
                  { label: 'Unit Price', value: formatAmount(parseFloat(line.pricePerUnit || '0'), currency) },
                  { label: 'Reason', value: line.reason || '—' },
                ]}
              />
            )}
          />
        </div>

        {/* Activity Timeline Card */}
        <div id="timeline-section" className="card">
          <ActivityTimeline events={returnDetails.events || []} />
        </div>
      </div>

      {/* Ship Return Drawer */}
      <SlideOver
        isOpen={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        title="Ship Purchase Return"
        subtitle={`Confirm shipment for ${returnDetails.returnNumber}`}
      >
        <div className="flex flex-col gap-4 p-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              Tracking Number / Consignment #
            </label>
            <input
              type="text"
              className="input w-full"
              value={shipTrackingNumber}
              onChange={(e) => setShipTrackingNumber(e.target.value)}
              placeholder="e.g. TRACK-98765421"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              Shipment / Courier Notes
            </label>
            <textarea
              className="input w-full min-h-[80px]"
              value={shipNotes}
              onChange={(e) => setShipNotes(e.target.value)}
              placeholder="Optional shipment notes, carrier name, or pickup details..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <Button variant="secondary" size="sm" onClick={() => setIsShipModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={submitting} onClick={handleShipReturnConfirm}>
              {shipSubmitLabel}
            </Button>
          </div>
        </div>
      </SlideOver>
    </DetailsLayout>
  );
}
