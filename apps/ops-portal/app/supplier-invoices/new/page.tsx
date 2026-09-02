'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice } from '@herobm/shared';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import SupplierSelect from '@/components/shared/SupplierSelect';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { useSettings } from '@/components/SettingsProvider';
import { calculatePurchaseInvoiceableQuantities, PurchaseInvoice } from '@/lib/purchase-order-utils';
import type { OrderDetail } from '@/app/purchase-orders/[id]/types';
import { Button } from '@/components/shared/Button';

interface LineItem {
  key: number;
  productId?: string;
  productNumber?: string;
  productDescription: string;
  quantityInvoiced: string;
  pricePerUnit: string;
  purchaseOrderLineId?: string;
}

let lineKey = 0;

function emptyLine(): LineItem {
  return {
    key: ++lineKey,
    productDescription: '',
    quantityInvoiced: '1',
    pricePerUnit: '0',
  };
}

export default function NewPurchaseInvoicePage() {
  const { baseCurrency } = useSettings();
  const t = useTranslations('purchaseOrders');
  const tCommon = useTranslations('common');
  useDocumentTitle('Enter Supplier Invoice');
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPurchaseOrderId = searchParams.get('purchaseOrderId');

  const [vendorId, setVendorId] = useState('');
  const [initialVendorSearchTerm, setInitialVendorSearchTerm] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [receiptFilename, setReceiptFilename] = useState('');
  const [notes, setNotes] = useState('');
  const [taxAmountInput, setTaxAmountInput] = useState('0');

  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(!!initialPurchaseOrderId);

  // Auto-fill logic from PO
  useEffect(() => {
    if (initialPurchaseOrderId) {
      Promise.all([
        api.purchaseOrdersControllerFindOne(initialPurchaseOrderId).then(r => r.data as unknown as OrderDetail),
        api.purchaseInvoiceControllerGetPurchaseBills(initialPurchaseOrderId).then(r => r.data),
      ]).then(([order, invoicesRes]) => {
        setVendorId(order.vendorId || '');
        if (order.vendorName) {
          setInitialVendorSearchTerm(order.vendorName);
        }
        setCurrencyCode(order.currencyCode || baseCurrency || '');

        const invoices = (
          Array.isArray(invoicesRes)
            ? invoicesRes
            : (invoicesRes as Record<string, unknown>)?.data || []
        ) as unknown as PurchaseInvoice[];
        const linesToInvoice = calculatePurchaseInvoiceableQuantities(order.lines, invoices);
        
        const prefilledLines: LineItem[] = linesToInvoice.map(lti => {
          const poLine = order.lines?.find(l => l.purchaseOrderLineId === lti.purchaseOrderLineId);
          return {
            key: ++lineKey,
            productId: poLine?.productId || '',
            productNumber: poLine ? poLine.productNumber || poLine.productId?.substring(0,8) || '' : '',
            productDescription: poLine?.productDescription || '',
            quantityInvoiced: lti.defaultQty,
            pricePerUnit: poLine?.pricePerUnit || '0',
            purchaseOrderLineId: lti.purchaseOrderLineId,
          };
        });

        if (prefilledLines.length > 0) {
          setLines(prefilledLines);
        } else {
          setLines([emptyLine()]);
        }
      }).catch(err => {
        reportError(err, 'NewPurchaseInvoicePage');
      }).finally(() => {
        setLoadingInitial(false);
      });
    }
  }, [initialPurchaseOrderId]);

  const updateLine = (idx: number, field: keyof LineItem, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantityInvoiced) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
    }).amount;
  };

  const subtotal = lines.reduce((sum, line) => sum + computeAmount(line), 0);
  const totalTax = parseFloat(taxAmountInput) || 0;
  const grandTotal = subtotal + totalTax;

  const handleSubmit = async () => {
    if (!vendorId) {
      setError(tCommon('errors.pleaseSelectSupplier'));
      return;
    }
    if (!supplierInvoiceNumber.trim()) {
      setError('Supplier Invoice Number is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: invoice } = await api.invoiceDetailControllerCreateDraftInvoice({
          vendorId,
          supplierInvoiceNumber,
          currencyCode,
          purchaseOrderId: initialPurchaseOrderId || undefined,
          totalAmount: grandTotal,
          taxAmount: totalTax,
          receiptFilename: receiptFilename || undefined,
          notes: notes || undefined,
          lines: lines.map((l: LineItem) => ({
            description: l.productDescription,
            productId: l.productId,
            quantityInvoiced: parseFloat(l.quantityInvoiced),
            pricePerUnit: parseFloat(l.pricePerUnit),
            purchaseOrderLineId: l.purchaseOrderLineId,
          })),
      });
      router.push(`/supplier-invoices/${(invoice).invoiceId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateInvoice'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title="Enter Supplier Invoice"
            actions={
              <>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => router.push(initialPurchaseOrderId ? `/purchase-orders/${initialPurchaseOrderId}` : '/supplier-invoices')}
                  disabled={submitting}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary" size="sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? tCommon('saving') : t('buttons.submitBill')}
                </Button>
              </>
            }
            showPrint={false}
          />
        }
      >
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="card">
            <h3 className="section-heading">
              { }
              <span className="material-symbols-outlined">receipt_long</span>
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('labels.supplier')} *
                </label>
                <SupplierSelect
                  value={vendorId}
                  onChange={(s) => {
                    setVendorId(s?.vendorId || '');
                    setCurrencyCode(s?.currencyCode || baseCurrency);
                  }}
                  placeholder={t('placeholders.searchSuppliers')}
                  required
                  initialSearchTerm={initialVendorSearchTerm}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('supplierInvoice.invoiceNumberLabel')}
                </label>
                <input
                  className="input"
                  placeholder="e.g. INV-2024-999"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tCommon('columns.currency')}
                </label>
                <input
                  className="input"
                  placeholder={baseCurrency}
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('supplierInvoice.receiptFilenameLabel')}
                </label>
                <input
                  className="input"
                  placeholder="e.g. receipt.pdf"
                  value={receiptFilename}
                  onChange={(e) => setReceiptFilename(e.target.value)}
                />
              </div>

              <div className="col-span-2 mt-2">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tCommon('notesCardHeading')}
                </label>
                <textarea
                  className="input w-full min-h-[80px] pt-3 resize-y"
                  placeholder={tCommon('notesCardPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading !mb-0">
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                <span className="material-symbols-outlined">list</span>
                {t('lineItems')}
              </h3>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={addLine}>
                  {t('supplierInvoice.addLine')}
                </Button>
              </div>
            </div>

            {/* Desktop Table */}
            <table className="table-lines hidden lg:table">
              <thead>
                <tr>
                  <th className="w-[40px]">#</th>
                  <th className="w-[160px]">{t('columns.product')}</th>
                  <th>{t('columns.description')}</th>
                  <th className="w-[110px] text-right">{t('columns.qtyToBill')}</th>
                  <th className="w-[130px] text-right">{t('columns.unitPrice')}</th>
                  <th className="w-[130px] text-right">{t('columns.amount')}</th>
                  <th className="w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td className="text-[var(--text-muted)]">{idx + 1}</td>
                    <td>
                      {line.productId ? (
                        <div className="font-semibold text-[var(--accent)]">
                          {line.productNumber || line.productId.substring(0, 8)}
                        </div>
                      ) : (
                        <ProductSearchInput
                          onSelect={(p) => {
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, productId: p.productId, productNumber: p.productNumber, productDescription: l.productDescription || p.name }
                                  : l,
                              ),
                            );
                          }}
                          placeholder="Search product…"
                          className="min-w-[120px]"
                        />
                      )}
                    </td>
                    <td>
                      <input
                        className="input w-full text-[13px]"
                        value={line.productDescription || ''}
                        onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                        placeholder="Description..."
                      />
                    </td>
                    <td className="text-right">
                      <input
                        className="input w-full text-right"
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantityInvoiced}
                        onChange={(e) => updateLine(idx, 'quantityInvoiced', e.target.value)}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        className="input w-full text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.pricePerUnit}
                        onChange={(e) => updateLine(idx, 'pricePerUnit', e.target.value)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateLine(idx, 'pricePerUnit', val.toFixed(2));
                        }}
                      />
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatAmount(computeAmount(line), currencyCode)}
                    </td>
                    <td>
                      {lines.length > 1 && (
                        <Button variant="danger" size="sm" onClick={() => removeLine(idx)}>
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-[var(--text-muted)] py-5">
                      {t('supplierInvoice.noItems')}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-[var(--border)]">
                  <td colSpan={5} className="text-right font-semibold text-[var(--text-muted)]">
                    {tCommon('subtotal')}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {formatAmount(subtotal, currencyCode)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right font-semibold text-[var(--text-muted)]">
                    {t('supplierInvoice.taxTotalAmount', { tax: tCommon('tax') })}
                  </td>
                  <td className="text-right">
                    <input
                      className="input w-full text-right font-semibold tabular-nums py-1 px-2"
                      type="number"
                      min="0"
                      step="0.01"
                      value={taxAmountInput}
                      onFocus={(e) => {
                        if (parseFloat(e.target.value) === 0) {
                          setTaxAmountInput('');
                        }
                      }}
                      onChange={(e) => setTaxAmountInput(e.target.value)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setTaxAmountInput(val.toFixed(2));
                        } else {
                          setTaxAmountInput('0.00');
                        }
                      }}
                    />
                  </td>
                  <td></td>
                </tr>
                <tr className="bg-blue-500/[0.02]">
                  <td colSpan={5} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
                    {tCommon('total')}
                  </td>
                  <td className="text-right font-extrabold text-[14px] text-[var(--accent)] tabular-nums">
                    {formatAmount(grandTotal, currencyCode)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="lg:hidden flex flex-col gap-4 mt-2">
              {lines.map((line, idx) => (
                <div key={line.key} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3 relative">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500 text-sm">{t('lineItemPrefix')} {idx + 1}</span>
                    {lines.length > 1 && (
                      <Button className="text-gray-400 hover:text-red-500" onClick={() => removeLine(idx)}>
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t('columns.product')}</label>
                    {line.productId ? (
                      <div className="font-semibold text-[var(--accent)]">
                        {line.productNumber || line.productId.substring(0, 8)}
                      </div>
                    ) : (
                      <ProductSearchInput
                        onSelect={(p) => {
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, productId: p.productId, productNumber: p.productNumber, productDescription: l.productDescription || p.name }
                                : l,
                            ),
                          );
                        }}
                        placeholder="Search product…"
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t('columns.description')}</label>
                    <input
                      className="input w-full text-sm"
                      value={line.productDescription || ''}
                      onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                      placeholder="Description..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">{t('columns.qtyToBill')}</label>
                      <input
                        className="input w-full text-right tabular-nums"
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantityInvoiced}
                        onChange={(e) => updateLine(idx, 'quantityInvoiced', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">{t('columns.unitPrice')}</label>
                      <input
                        className="input w-full text-right tabular-nums"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.pricePerUnit}
                        onChange={(e) => updateLine(idx, 'pricePerUnit', e.target.value)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateLine(idx, 'pricePerUnit', val.toFixed(2));
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-500">{t('columns.amount')}</span>
                    <span className="font-semibold text-[15px] text-[var(--accent)] tabular-nums">{formatAmount(computeAmount(line), currencyCode)}</span>
                  </div>
                </div>
              ))}

              {lines.length === 0 && (
                <div className="text-center text-slate-400 py-6 text-sm">
                  {t('supplierInvoice.noItems')}
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-500">{tCommon('subtotal')}</span>
                  <span className="font-semibold tabular-nums">{formatAmount(subtotal, currencyCode)}</span>
                </div>
                
                <div className="flex justify-between items-center gap-4">
                  <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">{t('supplierInvoice.taxTotalAmount', { tax: tCommon('tax') })}</span>
                  <input
                    className="input text-right font-semibold py-1 px-2 w-24 tabular-nums"
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmountInput}
                    onFocus={(e) => {
                      if (parseFloat(e.target.value) === 0) {
                        setTaxAmountInput('');
                      }
                    }}
                    onChange={(e) => setTaxAmountInput(e.target.value)}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setTaxAmountInput(val.toFixed(2));
                      } else {
                        setTaxAmountInput('0.00');
                      }
                    }}
                  />
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 bg-[rgba(59,130,246,0.02)] -mx-4 px-4 pb-1">
                  <span className="font-bold text-[13px] text-slate-700">{tCommon('total')}</span>
                  <span className="font-extrabold text-lg text-[var(--accent)] tabular-nums">{formatAmount(grandTotal, currencyCode)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DetailsLayout>
    </>
  );
}
