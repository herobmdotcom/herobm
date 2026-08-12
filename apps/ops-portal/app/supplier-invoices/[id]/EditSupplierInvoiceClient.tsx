'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { ValidState } from '@/types/states';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { PURCHASE_INVOICE_LIFECYCLE, PURCHASE_INVOICE_STATE, calculateEarlyPaymentDiscount, getErrorMessage } from '@herobm/shared';
import * as api from '@herobm/sdk';
import { useAuth } from '@/components/AuthGate';
import { useSupplierInvoice, PurchaseInvoiceDetails } from './useSupplierInvoice';
import PaymentManagerSlideOver from '@/app/payments/PaymentManagerSlideOver';
import { Button } from '@/components/shared/Button';
import SupplierInvoiceLinesTab from './SupplierInvoiceLinesTab';

export default function EditSupplierInvoiceClient({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations('purchaseOrders');
  const tCommon = useTranslations('common');
  const { permissions } = useAuth();
  const canManageGL = permissions.some(p => p.resource === 'gl' && p.action === 'write');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const {
    invoice, loading, saving,
    isMatchingMode, setIsMatchingMode,
    selectedInvoiceLineId, setSelectedInvoiceLineId,
    showDiscrepancyModal, setShowDiscrepancyModal,
    pendingState,
    setDiscrepanciesAcknowledged,
    editSupplierInvoiceNumber, setEditSupplierInvoiceNumber,
    editReceiptFilename, setEditReceiptFilename,
    editCurrencyCode, setEditCurrencyCode,
    editTaxAmount, setEditTaxAmount,
    editNotes, setEditNotes,
    editVendorId, setEditVendorId,
    glAccounts,
    headerDirty,
    discrepancies,
    matchingPanelLines,
    allowedTransitions,
    saveHeader,
    changeState,
    handleAutoMatch,
    handlePanelMatch,
    updateLine,
    removeLine,
    addBlankLine,
    addRoundingLine,
    handleProductSelect,
    handleUnresolve,
    loadInvoice,
  } = useSupplierInvoice(id);

  // Synthesize legacy payment allocations for display
  const displayAllocations = useMemo(() => {
    const allocs = [...(invoice?.allocations || [])];
    if (!invoice) return allocs;

    const heroBmAllocated = allocs.reduce((sum, a) => sum + parseFloat(a.allocatedAmount), 0);
    const totalAmount = parseFloat(invoice.totalAmount) || 0;
    const outstandingAmount = parseFloat(invoice.outstandingAmount ?? '0') || 0;
    
    const legacyPaidAmount = totalAmount - outstandingAmount - heroBmAllocated;
    
    if (legacyPaidAmount > 0.01) {
      allocs.push({
        allocationId: 'legacy',
        paymentId: '', // Non-clickable
        paymentNumber: 'Legacy Imported Payment',
        paymentDate: invoice.invoiceDate || invoice.createdOn,
        allocatedAmount: String(legacyPaidAmount),
        currencyCode: invoice.currencyCode,
      });
    }
    return allocs;
  }, [invoice]);

  useDocumentTitle(invoice ? `Invoice ${invoice.invoiceNumber}` : 'Loading Invoice...');

  // Auto-select first unmatched line when entering matching mode
  useEffect(() => {
    if (isMatchingMode && !selectedInvoiceLineId) {
      const first = invoice?.lines.find((l) => l.matchStatus !== 'MATCHED');
      if (first) setSelectedInvoiceLineId(first.lineId);
    }
    if (!isMatchingMode) setSelectedInvoiceLineId(null);
  }, [isMatchingMode, invoice?.lines, selectedInvoiceLineId, setSelectedInvoiceLineId]);

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">Loading...</div>;
  }

  if (!invoice) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">{tCommon('errors.failedToLoadOrder')}</div>;
  }

  const handleAdminMarkPaid = async () => {
    if (!window.confirm('This will mark the invoice as paid without generating a GL entry. Proceed?')) return;
    setMarkingPaid(true);
    try {
      await api.invoiceDetailControllerAdminMarkPurchaseInvoicePaid(id, {});
      window.location.reload();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

  const isEditable = invoice.stateCode === PURCHASE_INVOICE_STATE.DRAFT;

  const allocationColumns: DataTableColumn<typeof displayAllocations[0]>[] = [
    {
      id: 'paymentNo',
      header: t('columns.paymentNo'),
      width: 250,
      render: (alloc) => (
        alloc.paymentId ? (
          <span className="font-semibold cursor-pointer hover:underline" style={{ color: 'var(--accent)' }} onClick={() => setSelectedPaymentId(alloc.paymentId)}>
            {alloc.paymentNumber}
          </span>
        ) : (
          <span className="font-semibold">{alloc.paymentNumber}</span>
        )
      )
    },
    {
      id: 'date',
      header: t('columns.date'),
      render: (alloc) => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {formatLocalDate(alloc.paymentDate)}
        </span>
      )
    },
    {
      id: 'allocatedAmount',
      header: t('columns.allocatedAmount'),
      align: 'right',
      render: (alloc) => (
        <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatAmount(parseFloat(alloc.allocatedAmount), alloc.currencyCode)}
        </span>
      )
    }
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={invoice.supplierInvoiceNumber ? `Supplier Ref: ${invoice.supplierInvoiceNumber}` : undefined}
          badges={<StateBadge state={invoice.stateCode as ValidState} />}
          isSaving={saving}
          actions={
            <>
              {!headerDirty && allowedTransitions.includes(PURCHASE_INVOICE_STATE.CANCELLED) && (
                <Button
                  variant="danger" size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this invoice?')) {
                      changeState(PURCHASE_INVOICE_STATE.CANCELLED);
                    }
                  }}
                  disabled={saving}
                >
                  {tCommon('cancel')}
                </Button>
              )}
              {!headerDirty && invoice.stateCode === PURCHASE_INVOICE_STATE.DRAFT && allowedTransitions.includes(PURCHASE_INVOICE_STATE.INVOICED) && (
                <Button
                  variant="primary" size="sm"
                  onClick={() => changeState(PURCHASE_INVOICE_STATE.INVOICED)}
                  disabled={saving}
                >
                  {t('buttons.approveInvoice')}
                </Button>
              )}
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div id="details-section" className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">receipt_long</span>
            Invoice Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('labels.supplier')}
              </label>
              {isEditable ? (
                <div style={{ height: 38 }}>
                  <SupplierSelect
                    value={editVendorId}
                    initialSearchTerm={invoice.vendorName || invoice.vendorId}
                    onChange={(s) => {
                      if (s) {
                        setEditVendorId(s.vendorId);
                        saveHeader(s.vendorId);
                      }
                    }}
                    placeholder="Select supplier..."
                  />
                </div>
              ) : (
                <Link href={`/customers/${invoice.vendorId}`} className="text-sm text-[var(--brand-blue)] hover:underline">
                  {invoice.vendorName || invoice.vendorId}
                </Link>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('columns.supplierInvoiceNumber')}
              </label>
              {isEditable ? (
                <input
                  className="input"
                  value={editSupplierInvoiceNumber}
                  onChange={(e) => setEditSupplierInvoiceNumber(e.target.value)}
                  onBlur={() => saveHeader()}
                  placeholder="e.g. INV-2024-999"
                />
              ) : (
                <div className="text-sm">{invoice.supplierInvoiceNumber || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.currency')}
              </label>
              {isEditable ? (
                <input
                  className="input"
                  value={editCurrencyCode}
                  onChange={(e) => setEditCurrencyCode(e.target.value)}
                  onBlur={() => saveHeader()}
                  maxLength={3}
                />
              ) : (
                <div className="text-sm">{invoice.currencyCode}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('labels.receiptFilename')}
              </label>
              {isEditable ? (
                <input
                  className="input"
                  value={editReceiptFilename}
                  onChange={(e) => setEditReceiptFilename(e.target.value)}
                  onBlur={() => saveHeader()}
                  placeholder="e.g. receipt_scan.pdf"
                />
              ) : (
                <div className="text-sm">{invoice.receiptFilename || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.date')}
              </label>
              <div className="text-sm">
                {formatLocalDate(invoice.invoiceDate)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.dueDate')}
              </label>
              <div className="text-sm">
                {formatLocalDate(invoice.dueDate)}
              </div>
            </div>
            {invoice.earlyPaymentDiscount != null && invoice.earlyPaymentDiscountDays != null && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Early Payment Terms
                </label>
                <div className="text-sm">
                  {(() => {
                    const result = calculateEarlyPaymentDiscount({
                      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(invoice.createdOn),
                      outstandingAmount: invoice.outstandingAmount || '0',
                      earlyPaymentDiscount: invoice.earlyPaymentDiscount,
                      earlyPaymentDiscountDays: invoice.earlyPaymentDiscountDays,
                    });
                    const dateLimit = result.eligibleUntil ? formatLocalDate(result.eligibleUntil, undefined, '') : '';
                    
                    if (result.isEligible) {
                      return `${invoice.earlyPaymentDiscount}% (${formatAmount(result.discountAmount, invoice.currencyCode)}) in ${invoice.earlyPaymentDiscountDays} days (${dateLimit})`;
                    }
                    
                    return (
                      <>
                        <span className="text-[var(--text-muted)]">
                          {tCommon('earlyPaymentDiscountExpired', { discount: invoice.earlyPaymentDiscount, days: invoice.earlyPaymentDiscountDays, dateLimit })}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            <div className="md:col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('notesCardHeading')}
              </label>
              {isEditable ? (
                <input
                  className="input w-full"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onBlur={() => saveHeader()}
                  placeholder={tCommon('notesCardPlaceholder')}
                />
              ) : invoice.notes ? (
                <div className="text-sm bg-gray-50 p-3 rounded">{invoice.notes}</div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>
          </div>
        </div>

        <SupplierInvoiceLinesTab
          invoice={invoice}
          isMatchingMode={isMatchingMode}
          setIsMatchingMode={setIsMatchingMode}
          selectedInvoiceLineId={selectedInvoiceLineId}
          setSelectedInvoiceLineId={setSelectedInvoiceLineId}
          showDiscrepancyModal={showDiscrepancyModal}
          setShowDiscrepancyModal={setShowDiscrepancyModal}
          discrepancies={discrepancies}
          setDiscrepanciesAcknowledged={setDiscrepanciesAcknowledged}
          pendingState={pendingState}
          changeState={changeState}
          matchingPanelLines={matchingPanelLines}
          handlePanelMatch={handlePanelMatch}
          handleAutoMatch={handleAutoMatch}
          updateLine={updateLine}
          removeLine={removeLine}
          addBlankLine={addBlankLine}
          addRoundingLine={addRoundingLine}
          handleProductSelect={handleProductSelect}
          handleUnresolve={handleUnresolve}
          editTaxAmount={editTaxAmount}
          setEditTaxAmount={setEditTaxAmount}
          saveHeader={saveHeader}
          saving={saving}
          glAccounts={glAccounts}
          t={t}
          tCommon={tCommon}
        />

        {/* Payment Allocations Card */}
        <div id="allocations-section" className="card mt-4 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-0">{t('paymentAllocations')}</h2>
            {invoice.stateCode !== PURCHASE_INVOICE_STATE.PAID && invoice.stateCode !== PURCHASE_INVOICE_STATE.CANCELLED && canManageGL && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAdminMarkPaid}
                disabled={markingPaid}
              >
                {markingPaid ? tCommon('loadingEllipsis') : tCommon('markPaid')}
              </Button>
            )}
          </div>
            <div className="mt-2">
              <DataTable
                columns={allocationColumns}
                data={displayAllocations || []}
                keyExtractor={(row) => row.allocationId}
                mobileCard={(alloc) => (
                  <MobileLineItemCard
                    title={
                      alloc.paymentId ? (
                        <span className="font-semibold cursor-pointer hover:underline" style={{ color: 'var(--accent)' }} onClick={() => setSelectedPaymentId(alloc.paymentId)}>
                          {alloc.paymentNumber}
                        </span>
                      ) : (
                        <span className="font-semibold">{alloc.paymentNumber}</span>
                      )
                    }
                    subtitle={formatLocalDate(alloc.paymentDate)}
                    details={[
                      {
                        label: t('columns.allocatedAmount'),
                        value: formatAmount(parseFloat(alloc.allocatedAmount), alloc.currencyCode),
                        isHighlighted: true
                      }
                    ]}
                  />
                )}
              />
            </div>
        </div>

      </div>

      {selectedPaymentId && (
        <PaymentManagerSlideOver
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
          onSaved={(close) => {
            if (close !== false) setSelectedPaymentId(null);
            loadInvoice();
          }}
        />
      )}
    </DetailsLayout>
  );
}
