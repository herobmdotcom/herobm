import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MATCH_STATUS, PURCHASE_INVOICE_STATE } from '@herobm/shared';
import POMatchingPanel from '@/components/shared/POMatchingPanel';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import type { PurchaseInvoiceDetails } from './useSupplierInvoice';
import type { GlAccountResponseDto } from '@herobm/sdk';

interface SupplierInvoiceLinesTabProps {
  invoice: PurchaseInvoiceDetails;
  isMatchingMode: boolean;
  setIsMatchingMode: (val: boolean) => void;
  selectedInvoiceLineId: string | null;
  setSelectedInvoiceLineId: (val: string | null) => void;
  showDiscrepancyModal: boolean;
  setShowDiscrepancyModal: (val: boolean) => void;
  discrepancies: { type: string; [key: string]: unknown }[];
  setDiscrepanciesAcknowledged: (val: boolean) => void;
  pendingState: string | null;
  changeState: (state: string, skipValidation?: boolean) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
  matchingPanelLines: any[];
  handlePanelMatch: (invoiceLineId: string, purchaseOrderLineId: string) => void;
  handleAutoMatch: (purchaseOrderId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
  updateLine: (lineId: string, field: string, value: any) => Promise<void> | void;
  removeLine: (lineId: string) => void;
  addBlankLine: () => void;
  addRoundingLine: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
  handleProductSelect: (lineId: string, product: any) => void;
  handleUnresolve: (lineId: string) => void;
  editTaxAmount: string;
  setEditTaxAmount: (val: string) => void;
  saveHeader: (vendorId?: string) => void;
  saving: boolean;
  glAccounts: GlAccountResponseDto[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl hook
  t: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl hook
  tCommon: any;
}

export default function SupplierInvoiceLinesTab({
  invoice,
  isMatchingMode, setIsMatchingMode,
  selectedInvoiceLineId, setSelectedInvoiceLineId,
  showDiscrepancyModal, setShowDiscrepancyModal,
  discrepancies,
  setDiscrepanciesAcknowledged,
  pendingState,
  changeState,
  matchingPanelLines,
  handlePanelMatch,
  handleAutoMatch,
  updateLine,
  removeLine,
  addBlankLine,
  addRoundingLine,
  handleProductSelect,
  handleUnresolve,
  editTaxAmount, setEditTaxAmount,
  saveHeader,
  saving,
  glAccounts,
  t, tCommon
}: SupplierInvoiceLinesTabProps) {

  const isEditable = invoice.stateCode === PURCHASE_INVOICE_STATE.DRAFT;
  const canEditLines = isEditable && !isMatchingMode;
  const matchIcon = isMatchingMode ? 'check' : 'link';

  const InvoiceAllocationCell = ({ line }: { line: PurchaseInvoiceDetails['lines'][0] }) => {
    if (line.matchStatus === MATCH_STATUS.MATCHED) {
      return (
        <div className="flex items-center justify-between gap-2 h-full w-full">
          <div className="flex flex-col gap-1">
            <Link href={`/purchase-orders/${line.purchaseOrderId}`} className="text-[var(--brand-blue)] hover:underline" style={{ fontWeight: 500, fontSize: 12 }}>
              {t('poNumberLabel', { number: line.purchaseOrderNumber || '' })}
            </Link>
          </div>
          {isEditable && (
            <Button
              variant="secondary" size="sm"
              onClick={() => handleUnresolve(line.lineId)}
              style={{ padding: '0 6px', height: 22, fontSize: 11 }}
              title="Change Allocation"
            >
              {t('buttons.change')}
            </Button>
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
            <option value="" disabled>{t('selectGlAccount')}</option>
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
            {glAccounts.find(a => a.glAccountId === line.glAccountId)?.name || t('defaultExpense')}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div id="lines-section" style={{ display: 'flex', gap: 0, minHeight: 0 }}>
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading" style={{ marginBottom: 0 }}>
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined">list</span>
              {t('lineItems')}
            </h3>
            {isEditable && (
              <div className="flex gap-2">
                <Button
                  size="sm" variant={isMatchingMode ? 'primary' : 'secondary'}
                  onClick={() => setIsMatchingMode(!isMatchingMode)}
                  disabled={saving}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>
                    {matchIcon}
                  </span>
                  {isMatchingMode ? t('matching.panelTitle') : t('matching.panelTitle')}
                </Button>
                {!isMatchingMode && (
                  <>
                    <Button
                      variant="secondary" size="sm"
                      onClick={addBlankLine}
                      disabled={saving}
                    >
                      {t('addLine')}
                    </Button>
                    <Button
                      variant="secondary" size="sm"
                      onClick={addRoundingLine}
                      disabled={saving}
                    >
                      {t('addRoundingAdj')}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          {/* Desktop Table */}
          <table className="table-lines hidden lg:table" style={isMatchingMode ? { fontSize: 11 } : undefined}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 150 }}>{t('columns.product')}</th>
                <th>{t('columns.description')}</th>
                {!isMatchingMode && <th style={{ width: 280 }}>{t('columns.allocation')}</th>}
                <th style={{ width: 90, textAlign: 'right' }}>{t('columns.qtyToBill')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.unitPrice')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.amount')}</th>
                {!isMatchingMode && isEditable && <th style={{ width: 50 }}></th>}
                {isMatchingMode && <th style={{ width: 70, textAlign: 'center' }}>{t('columns.status')}</th>}
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
                          step="any"
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
                        <Button
                          variant="ghost"
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => removeLine(line.lineId)}
                          title="Remove Line"
                        >
                          {'✕'}
                        </Button>
                      </td>
                    )}
                    {isMatchingMode && (
                      <td style={{ textAlign: 'center' }}>
                        {line.matchStatus === MATCH_STATUS.MATCHED ? (
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--badge-shipped)' }}>{'✓'}</span>
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
                    {t('noItems')}
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

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 lg:hidden mt-2">
            {invoice.lines?.map((line, idx) => {
              const isSelected = isMatchingMode && selectedInvoiceLineId === line.lineId;
              const isUnmatched = line.matchStatus !== MATCH_STATUS.MATCHED;
              return (
                <div
                  key={`mob-wrap-${line.lineId}`}
                  onClick={isMatchingMode && isUnmatched && isEditable ? () => setSelectedInvoiceLineId(line.lineId) : undefined}
                  style={{
                    cursor: isMatchingMode && isUnmatched && isEditable ? 'pointer' : undefined,
                    borderLeft: isSelected ? '3px solid var(--accent)' : undefined,
                    background: isSelected ? 'rgba(0, 107, 92, 0.04)' : undefined,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <MobileLineItemCard
                    key={`mob-${line.lineId}`}
                    topRightBadge={`#${idx + 1}`}
                    title={
                      <div className="flex items-center gap-2">
                        {canEditLines && (!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') ? (
                          <ProductSearchInput
                            onSelect={(p) => handleProductSelect(line.lineId, p)}
                            placeholder="Search product…"
                          />
                        ) : line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                          <span className="font-bold" style={{ color: 'var(--accent)' }}>
                            {line.productNumber || line.productId.substring(0, 8)}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-500">{t('customItem')}</span>
                        )}
                        {canEditLines && (
                          <Button variant="ghost" className="text-gray-400 hover:text-red-500 ml-auto" onClick={(e) => { e.stopPropagation(); removeLine(line.lineId); }}>
                            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                          </Button>
                        )}
                      </div>
                    }
                    subtitle={
                      canEditLines ? (
                        <input
                          className="input w-full text-sm mt-1"
                          defaultValue={line.description || ''}
                          key={`desc-mob-${line.lineId}-${line.description}`}
                          onBlur={(e) => {
                            if (e.target.value !== (line.description || '')) {
                              updateLine(line.lineId, 'description', e.target.value);
                            }
                          }}
                          placeholder="Description"
                        />
                      ) : (
                        <span>{line.description || '—'}</span>
                      )
                    }
                    details={[
                      ...(isMatchingMode ? [{
                        label: 'Status',
                        value: line.matchStatus === MATCH_STATUS.MATCHED ? (
                          <span style={{ fontWeight: 600, color: 'var(--badge-shipped)' }}>{t('matching.matched')}</span>
                        ) : (
                          <span className="text-[var(--text-muted)]">{t('matching.unmatched')}</span>
                        )
                      }] : []),
                      {
                        label: t('columns.qtyToBill'),
                        value: canEditLines ? (
                          <input
                            className="input"
                            type="number"
                            step="any"
                            style={{ width: '80px', textAlign: 'right' }}
                            defaultValue={line.quantityInvoiced}
                            key={`qty-mob-${line.lineId}-${line.quantityInvoiced}`}
                            onBlur={(e) => {
                              if (e.target.value !== line.quantityInvoiced) {
                                updateLine(line.lineId, 'quantityInvoiced', e.target.value);
                              }
                            }}
                          />
                        ) : (
                          <span className="font-medium text-[var(--text-primary)]">{parseFloat(line.quantityInvoiced)}</span>
                        ),
                      },
                      {
                        label: t('columns.unitPrice'),
                        value: canEditLines ? (
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            style={{ width: '90px', textAlign: 'right' }}
                            defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                            key={`price-mob-${line.lineId}-${line.pricePerUnit}`}
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
                          <span className="font-medium text-[var(--text-primary)]">{formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)}</span>
                        ),
                      },
                      {
                        label: t('columns.amount'),
                        value: formatAmount(parseFloat(line.amount), invoice.currencyCode),
                        isHighlighted: true
                      }
                    ]}
                  >
                    {!isMatchingMode && (
                      <div className="pt-2 mt-2 border-t border-slate-100">
                        <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">{t('columns.allocation')}</label>
                        <div className="border border-slate-200 rounded p-2 bg-[var(--bg-primary)]">
                          <InvoiceAllocationCell line={line} />
                        </div>
                      </div>
                    )}
                  </MobileLineItemCard>
                </div>
              );
            })}

            {(!invoice.lines || invoice.lines.length === 0) && (
              <div className="text-center text-[var(--text-muted)] py-6 text-sm">
                {t('noItems')}
              </div>
            )}

            <div className="mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
                      {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
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
                  </tr>
                  <tr>
                    <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                    <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">
                      {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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
            <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">{t('invoiceDiscrepancies')}</h2>
                <Button variant="ghost" onClick={() => setShowDiscrepancyModal(false)} className="text-gray-400 hover:text-gray-600">
                  <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                </Button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{t('columns.line')}</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{t('columns.issueType')}</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{t('columns.details')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {discrepancies.map((d, i) => {
                        const lineIdx = invoice.lines.findIndex(l => l.lineId === d.lineId);
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-500 font-medium">{lineIdx + 1}</td>
                            <td className="px-4 py-3 text-xs text-gray-900 font-bold uppercase tracking-tight">
                              {(d as { type?: string }).type?.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{(d as { message?: string }).message}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDiscrepancyModal(false)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      setDiscrepanciesAcknowledged(true);
                      setShowDiscrepancyModal(false);
                      if (pendingState) {
                        await changeState(pendingState, true);
                      }
                    }}
                  >
                    {tCommon('confirm')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
