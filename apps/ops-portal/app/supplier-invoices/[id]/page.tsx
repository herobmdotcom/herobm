'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';
import POMatchingPanel from '@/components/shared/POMatchingPanel';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { cap, isBackTransition, PURCHASE_INVOICE_LIFECYCLE, PURCHASE_INVOICE_STATE, MATCH_STATUS } from '@modbm/shared';
import { useSupplierInvoice, PurchaseInvoiceDetails } from './useSupplierInvoice';

export default function PurchaseInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = React.use(params);
  const t = useTranslations('purchaseOrders');
  const tCommon = useTranslations('common');
  
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
  } = useSupplierInvoice(id);

  useDocumentTitle(invoice ? `Invoice ${invoice.invoiceNumber}` : 'Loading Invoice...');

  // Auto-select first unmatched line when entering matching mode
  useEffect(() => {
    if (isMatchingMode && !selectedInvoiceLineId) {
      const first = invoice?.lines.find((l) => l.matchStatus !== MATCH_STATUS.MATCHED);
      if (first) setSelectedInvoiceLineId(first.lineId);
    }
    if (!isMatchingMode) setSelectedInvoiceLineId(null);
  }, [isMatchingMode]);

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">Loading...</div>;
  }

  if (!invoice) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">Invoice not found.</div>;
  }

  const isEditable = invoice.stateCode === PURCHASE_INVOICE_STATE.DRAFT;
  const canEditLines = isEditable && !isMatchingMode;
  const isBack = (from: string, to: string) => isBackTransition(PURCHASE_INVOICE_LIFECYCLE, from, to);

  const InvoiceAllocationCell = ({ line }: { line: PurchaseInvoiceDetails['lines'][0] }) => {
    if (line.matchStatus === MATCH_STATUS.MATCHED) {
      return (
        <div className="flex items-center justify-between gap-2 h-full w-full">
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Inventory Asset</span>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span style={{ fontWeight: 500, fontSize: 12 }}>PO {line.purchaseOrderNumber}</span>
          </div>
          {isEditable && (
            <button
              onClick={() => handleUnresolve(line.lineId)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0 6px', height: 22, fontSize: 11 }}
              title="Change Allocation"
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              Change
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2 w-full h-full">
        {isEditable ? (
          <select
            className="input"
            style={{ width: '100%', fontSize: 12, padding: '2px 6px' }}
            value={line.glAccountId || ''}
            onChange={(e) => updateLine(line.lineId, 'glAccountId', e.target.value)}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <option value="" disabled>Select GL Account...</option>
            {glAccounts
              .filter(a => a.accountType === 'expense' || a.accountType === 'asset' || a.accountType === 'liability')
              .map((acc) => (
                <option key={acc.glAccountId} value={acc.glAccountId}>
                  {acc.accountCode} - {acc.name}
                </option>
            ))}
          </select>
        ) : (
          <div className="text-xs truncate">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {glAccounts.find(a => a.glAccountId === line.glAccountId)?.name || t('defaultExpense')}
          </div>
        )}
      </div>
    );
  };

  const matchIcon = isMatchingMode ? 'check' : 'link';

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={invoice.supplierInvoiceNumber ? `Supplier Ref: ${invoice.supplierInvoiceNumber}` : undefined}
          onBack={() => router.push('/supplier-invoices')}
          badges={<StateBadge state={invoice.stateCode as ValidState} />}
          isSaving={saving}
          actions={
            <>
              {headerDirty && isEditable && (
                <button className="btn btn-primary btn-sm" onClick={() => saveHeader()} disabled={saving}>
                  {tCommon('save', { defaultValue: 'Save' })}
                </button>
              )}
              {!headerDirty && allowedTransitions.includes(PURCHASE_INVOICE_STATE.CANCELLED) && (
                <button 
                  className="btn btn-danger btn-sm" 
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this invoice?')) {
                      changeState(PURCHASE_INVOICE_STATE.CANCELLED);
                    }
                  }} 
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
              {!headerDirty && allowedTransitions.includes(PURCHASE_INVOICE_STATE.INVOICED) && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => changeState(PURCHASE_INVOICE_STATE.INVOICED)} 
                  disabled={saving}
                >
                  Approve Invoice
                </button>
              )}
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">receipt_long</span>
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Supplier
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
                <div className="text-sm">{invoice.vendorName || invoice.vendorId}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Supplier Invoice No.
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
                Receipt Filename
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
            <div className="col-span-2 mt-2">
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

        <div style={{ display: 'flex', gap: 0, minHeight: 0 }}>
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading" style={{ marginBottom: 0 }}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">list</span>
              {t('lineItems')}
            </h3>
            {isEditable && (
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${isMatchingMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setIsMatchingMode(!isMatchingMode)}
                  disabled={saving}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>
                    {matchIcon}
                  </span>
                  {isMatchingMode ? t('matching.panelTitle') : t('matching.panelTitle')}
                </button>
                {!isMatchingMode && (
                <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={addBlankLine}
                  disabled={saving}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  + Line
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={addRoundingLine}
                  disabled={saving}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  + Rounding Adj
                </button>
                </>
                )}
              </div>
            )}
          </div>
          <table className="table-lines" style={isMatchingMode ? { fontSize: 11 } : undefined}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 150 }}>{t('columns.product')}</th>
                <th>{t('columns.description')}</th>
                {!isMatchingMode && <th style={{ width: 280 }}>Allocation</th>}
                <th style={{ width: 90, textAlign: 'right' }}>{t('columns.qtyToBill', { defaultValue: 'Qty' })}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.unitPrice')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.amount')}</th>
                {!isMatchingMode && isEditable && <th style={{ width: 50 }}></th>}
                {isMatchingMode && <th style={{ width: 70, textAlign: 'center' }}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => {
                const isSelected = isMatchingMode && selectedInvoiceLineId === line.lineId;
                const isUnmatched = line.matchStatus !== MATCH_STATUS.MATCHED;
                return (
                <tr
                  key={line.lineId}
                  onClick={isMatchingMode && isUnmatched && isEditable ? () => setSelectedInvoiceLineId(line.lineId) : undefined}
                  style={{
                    cursor: isMatchingMode && isUnmatched && isEditable ? 'pointer' : undefined,
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    background: isSelected ? 'rgba(0, 107, 92, 0.04)' : undefined,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    {canEditLines && (!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') ? (
                      <ProductSearchInput
                        onSelect={(p) => handleProductSelect(line.lineId, p)}
                        placeholder="Search product…"
                        style={{ minWidth: 120 }}
                      />
                    ) : line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      <div className="font-semibold" style={{ color: 'var(--accent)' }}>
                        {line.productNumber || line.productId.substring(0, 8)}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {canEditLines ? (
                      <input
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                        defaultValue={line.description || ''}
                        key={`desc-${line.lineId}-${line.description}`}
                        onBlur={(e) => {
                          if (e.target.value !== (line.description || '')) {
                            updateLine(line.lineId, 'description', e.target.value);
                          }
                        }}
                        placeholder="Description"
                      />
                    ) : (
                      <div>{line.description || '—'}</div>
                    )}
                  </td>
                  {!isMatchingMode && (
                  <td>
                    <InvoiceAllocationCell line={line} />
                  </td>
                  )}
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {canEditLines ? (
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ width: '100%', textAlign: 'right' }}
                        defaultValue={line.quantityInvoiced}
                        key={`qty-${line.lineId}-${line.quantityInvoiced}`}
                        onBlur={(e) => {
                          if (e.target.value !== line.quantityInvoiced) {
                            updateLine(line.lineId, 'quantityInvoiced', e.target.value);
                          }
                        }}
                      />
                    ) : (
                      parseFloat(line.quantityInvoiced)
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {canEditLines ? (
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ width: '100%', textAlign: 'right' }}
                        defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                        key={`price-${line.lineId}-${line.pricePerUnit}`}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                          e.target.value = formatted;
                          if (formatted !== parseFloat(line.pricePerUnit || '0').toFixed(2)) {
                            updateLine(line.lineId, 'pricePerUnit', formatted);
                          }
                        }}
                      />
                    ) : (
                      formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(parseFloat(line.amount), invoice.currencyCode)}
                  </td>
                  {canEditLines && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => removeLine(line.lineId)}
                        title="Remove Line"
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        ✕
                      </button>
                    </td>
                  )}
                  {isMatchingMode && (
                    <td style={{ textAlign: 'center' }}>
                      {line.matchStatus === MATCH_STATUS.MATCHED ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--badge-shipped)' }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
              {(!invoice.lines || invoice.lines.length === 0) && (
                <tr>
                  <td colSpan={isEditable ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                    No items
                  </td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('subtotal')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
                </td>
                {isEditable && <td></td>}
              </tr>
              <tr>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('tax')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {isEditable ? (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ width: 100, textAlign: 'right', padding: '2px 8px', height: 26 }}
                      value={editTaxAmount}
                      onFocus={(e) => {
                        if (parseFloat(e.target.value) === 0) {
                          setEditTaxAmount('');
                        }
                      }}
                      onChange={(e) => setEditTaxAmount(e.target.value)}
                      onBlur={() => {
                        if (editTaxAmount === '') {
                          setEditTaxAmount('0.00');
                        }
                        saveHeader();
                      }}
                    />
                  ) : (
                    formatAmount(parseFloat(invoice.taxAmount), invoice.currencyCode)
                  )}
                </td>
                {isEditable && <td></td>}
              </tr>
              <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {tCommon('total')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
                </td>
                {isEditable && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>

      {/* Right: Matching Panel */}
      {isMatchingMode && isEditable && invoice.vendorId && (
        <POMatchingPanel
          vendorId={invoice.vendorId}
          currencyCode={invoice.currencyCode}
          invoiceLines={matchingPanelLines}
          selectedLineId={selectedInvoiceLineId}
          onMatch={handlePanelMatch}
          onAutoMatch={handleAutoMatch}
          onClose={() => setIsMatchingMode(false)}
        />
      )}

      {showDiscrepancyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Invoice Discrepancies</h2>
              <button onClick={() => setShowDiscrepancyModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Line</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Issue Type</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {discrepancies.map((d, i) => {
                      const lineIdx = invoice.lines.findIndex(l => l.lineId === d.lineId);
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-500 font-medium">{lineIdx + 1}</td>
                          <td className="px-4 py-3 text-xs text-gray-900 font-bold uppercase tracking-tight">
                            {d.type.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{d.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDiscrepancyModal(false)}
                >
                  {tCommon('cancel')}
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    setDiscrepanciesAcknowledged(true);
                    setShowDiscrepancyModal(false);
                    if (pendingState) {
                      await changeState(pendingState, true);
                    }
                  }}
                >
                  {tCommon('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Payment Allocations Card */}
      <div className="card mt-4 p-5">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Payment Allocations</h2>
        <p className="text-sm text-gray-500">
          When payments are allocated to this invoice from the Payment Manager, they will appear here.
        </p>
      </div>

      </div>
    </DetailsLayout>
  );
}
