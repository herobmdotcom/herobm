'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice } from '@modbm/shared';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import SupplierSelect from '@/components/shared/SupplierSelect';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { useSettings } from '@/components/SettingsProvider';
import { calculatePurchaseInvoiceableQuantities, PurchaseInvoice } from '@/lib/purchase-order-utils';
import type { OrderDetail } from '@/app/purchase-orders/[id]/types';

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
        api.purchaseOrdersControllerFindOne(initialPurchaseOrderId).then(r => r.data),
        api.purchaseInvoiceControllerGetPurchaseBills(initialPurchaseOrderId).then(r => r.data),
      ]).then(([order, invoicesRes]) => {
        setVendorId(order.vendorId || '');
        if (order.vendorName) {
          setInitialVendorSearchTerm(order.vendorName);
        }
        setCurrencyCode(order.currencyCode || baseCurrency || '');

        const invoices = (invoicesRes.data || []) as unknown as PurchaseInvoice[];
        const linesToInvoice = calculatePurchaseInvoiceableQuantities(order.lines as any[], invoices);
        
        const prefilledLines: LineItem[] = linesToInvoice.map(lti => {
          const poLine = order.lines?.find(l => l.purchaseOrderLineId === lti.purchaseOrderLineId);
          return {
            key: ++lineKey,
            productId: poLine?.productId || '',
            productNumber: poLine ? (poLine as any).productNumber || poLine?.productId?.substring(0,8) : '',
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
        header={
          <EntityHeader
            title="Enter Supplier Invoice"
            onBack={() => router.push(initialPurchaseOrderId ? `/purchase-orders/${initialPurchaseOrderId}` : '/supplier-invoices')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push(initialPurchaseOrderId ? `/purchase-orders/${initialPurchaseOrderId}` : '/supplier-invoices')}
                  disabled={submitting}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? tCommon('saving') : t('buttons.submitBill', { defaultValue: 'Submit Bill' })}
                </button>
              </>
            }
            showPrint={false}
          />
        }
      >
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">receipt_long</span>
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('notesCardHeading')}
                </label>
                <textarea
                  className="input w-full"
                  style={{ minHeight: 80, paddingTop: 12, resize: 'vertical' }}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">list</span>
                {t('lineItems')}
              </h3>
              <div className="flex items-center gap-3">
                <button className="btn btn-secondary btn-sm" onClick={addLine}>
                  {t('supplierInvoice.addLine')}
                </button>
              </div>
            </div>

            <table className="table-lines">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 160 }}>{t('columns.product')}</th>
                  <th>{t('columns.description')}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{t('columns.qtyToBill', { defaultValue: 'Qty' })}</th>
                  <th style={{ width: 130, textAlign: 'right' }}>{t('columns.unitPrice')}</th>
                  <th style={{ width: 130, textAlign: 'right' }}>{t('columns.amount')}</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      {line.productId ? (
                        <div className="font-semibold" style={{ color: 'var(--accent)' }}>
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
                          style={{ minWidth: 120 }}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                        value={line.productDescription || ''}
                        onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                        placeholder="Description..."
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={line.quantityInvoiced}
                        onChange={(e) => updateLine(idx, 'quantityInvoiced', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={line.pricePerUnit}
                        onChange={(e) => updateLine(idx, 'pricePerUnit', e.target.value)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateLine(idx, 'pricePerUnit', val.toFixed(2));
                        }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatAmount(computeAmount(line), currencyCode)}
                    </td>
                    <td>
                      {lines.length > 1 && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeLine(idx)}>
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                      {t('supplierInvoice.noItems')}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {tCommon('subtotal')}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(subtotal, currencyCode)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('supplierInvoice.taxTotalAmount', { tax: tCommon('tax') })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ width: '100%', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '4px 8px' }}
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
                <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    {tCommon('total')}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(grandTotal, currencyCode)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DetailsLayout>
    </>
  );
}
