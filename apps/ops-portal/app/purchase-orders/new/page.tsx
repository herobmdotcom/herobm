'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice, computeOrderTotals } from '@modbm/shared';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import LocationSelect from '@/components/shared/LocationSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { getTaxLabel } from '../[id]/types';
import { useSettings } from '@/components/SettingsProvider';

interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  currencyCode: string;
}

interface LineItem {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  unitOfMeasure: string;
  discountPercentage: string;
  taxCategoryId: string | null;
}

let lineKey = 0;

function emptyLine(defaultTaxCategoryId = ''): LineItem {
  return {
    key: ++lineKey,
    productId: '',
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0',
    unitOfMeasure: 'EA',
    discountPercentage: '0',
    taxCategoryId: defaultTaxCategoryId || null,
  };
}

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

function generateOrderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${today}-${rand}`;
}

export default function NewPurchaseOrderPage() {
  const { baseCurrency } = useSettings();
  const t = useTranslations();
  useDocumentTitle(t('purchaseOrders.newOrderTitle'));
  const router = useRouter();
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const defaultTaxCategoryId = taxCategories.find((c) => c.isDefault)?.taxCategoryId || '';

  useEffect(() => {
    apiFetch<TaxCategory[]>('/api/tax-categories')
      .then(setTaxCategories)
      .catch((err) => reportError(err, 'NewPurchaseOrderPage'));
  }, []);

  // When tax categories load, backfill the default onto lines that have none
  useEffect(() => {
    if (!defaultTaxCategoryId) return;
    setLines((prev) =>
      prev.map((l) => (l.taxCategoryId ? l : { ...l, taxCategoryId: defaultTaxCategoryId })),
    );
  }, [defaultTaxCategoryId]);

  const [vendorId, setVendorId] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [name, setName] = useState('');
  const [deliveryLocationId, setDeliveryLocationId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<LineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');



  const addBlankLine = () => {
    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey, // Assuming 'key' is still needed for React lists
        productId: CUSTOM_LINE_ID,
        productNumber: '', // Added to match LineItem interface
        productDescription: '',
        quantity: '1',
        pricePerUnit: '0.00',
        unitOfMeasure: 'EA',
        discountPercentage: '0',
        taxCategoryId: defaultTaxCategoryId || null,
      },
    ]);
  };

  const addLineFromProduct = (p: Product) => {
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey,
        productId: p.productId,
        productNumber: p.productNumber,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.standardCost || p.tradePrice || p.listPrice || '0').toFixed(2),
        unitOfMeasure: 'EA',
        discountPercentage: '0',
        taxCategoryId: defaultTaxCategoryId || null,
      },
    ]);
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(defaultTaxCategoryId)]);
  };

  const computeTax = (line: LineItem) => {
    const cat = taxCategories.find(c => c.taxCategoryId === line.taxCategoryId);
    if (!cat) {
      const defaultCat = taxCategories.find(c => c.isDefault);
      if (!defaultCat) return 0;
      return computeLinePrice({
        quantity: parseFloat(line.quantity) || 0,
        pricePerUnit: parseFloat(line.pricePerUnit) || 0,
        discountPercentage: parseFloat(line.discountPercentage) || 0,
        taxRate: parseFloat(defaultCat.rate) || 0,
      }).tax;
    }
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
      taxRate: parseFloat(cat.rate) || 0,
    }).tax;
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
    }).amount;
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      setError(t('common.errors.pleaseSelectSupplier'));
      return;
    }
    if (!deliveryLocationId) {
      setError(t('common.errors.pleaseSelectLocation'));
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId)) {
      setError(t('common.errors.pleaseAddLineItem'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const order = await apiMutate<{ purchaseOrderId: string }>('/api/purchase-orders', 'POST', {
        orderNumber: generateOrderNumber(),
        name: name || undefined,
        vendorId,
        currencyCode,
        deliveryLocationId: deliveryLocationId || undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            productDescription: l.productDescription,
            quantity: l.quantity,
            pricePerUnit: l.pricePerUnit,
            unitOfMeasure: l.unitOfMeasure,
            discountPercentage: l.discountPercentage,
            taxCategoryId: l.taxCategoryId,
          })),
      });
      router.push(`/purchase-orders/${order.purchaseOrderId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToCreatePO'));
    } finally {
      setSubmitting(false);
    }
  };

  const mappedLines = lines.map(l => ({
    amount: computeAmount(l),
    tax: computeTax(l)
  }));
  const totals = computeOrderTotals(mappedLines);
  const subtotal = totals.subtotal;
  const totalTax = totals.totalTax;

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={t('purchaseOrders.createTitle')}
            onBack={() => router.push('/purchase-orders')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/purchase-orders')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? t('common.saving') : t('purchaseOrders.buttons.createPO')}
                </button>
              </>
            }
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
          {/* Order header */}
          <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">receipt_long</span>
            {t('purchaseOrders.orderDetails')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('purchaseOrders.labels.supplier')} *
                {vendorId && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: 'rgba(59,130,246,0.15)',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      fontSize: 10,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {currencyCode}
                  </span>
                )}
              </label>
              <SupplierSelect
                value={vendorId}
                onChange={(s) => {
                  setVendorId(s?.vendorId || '');
                  setCurrencyCode(s?.currencyCode || baseCurrency);
                }}
                placeholder={t('purchaseOrders.placeholders.searchSuppliers')}
                required
              />
            </div>

             <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('purchaseOrders.labels.referenceNumber')}
              </label>
              <input
                id="order-invoice"
                className="input"
                placeholder={t('purchaseOrders.placeholders.referenceNumber')}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('purchaseOrders.labels.location')} *
              </label>
              <LocationSelect
                value={deliveryLocationId}
                onChange={setDeliveryLocationId}
                placeholder={t('common.selectEllipsis')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('purchaseOrders.labels.orderName')}
              </label>
              <input
                id="order-name"
                className="input"
                placeholder={t('purchaseOrders.placeholders.orderName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.columns.currency')}
              </label>
              <input
                id="order-currency"
                className="input"
                placeholder={baseCurrency}
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.notesCardHeading')}
              </label>
              <textarea
                id="order-notes"
                className="input w-full"
                style={{ minHeight: 80, paddingTop: 12, resize: 'vertical' }}
                placeholder={t('common.notesCardPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            </div>
          </div>

        {/* Line items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">list</span>
              {t('purchaseOrders.lineItems')}
            </h3>
            <div className="flex items-center gap-3">
              <ProductSearchInput
                onSelect={addLineFromProduct}
                placeholder={t('purchaseOrders.placeholders.searchProduct')}
                style={{ width: 240 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLine}>
                + {t('purchaseOrders.buttons.customLine')}
              </button>
            </div>
          </div>

          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>{t('purchaseOrders.columns.lineNumber')}</th>
                <th>{t('purchaseOrders.columns.product')}</th>
                <th>{t('purchaseOrders.columns.description')}</th>
                <th style={{ width: 90, textAlign: 'right' }}>{t('purchaseOrders.columns.qty')}</th>
                <th style={{ width: 80, textAlign: 'right' }}>{t('purchaseOrders.columns.uom')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('purchaseOrders.columns.unitPrice')}</th>
                <th style={{ width: 80, textAlign: 'right' }}>{t('purchaseOrders.columns.discountPct' as any)}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('purchaseOrders.columns.taxCategory' as any)}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('purchaseOrders.columns.amount')}</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      <div className="flex items-center gap-2">
                        <span>{line.productNumber}</span>
                        <button
                          className="text-xs cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => {
                            updateLine(idx, 'productId', '00000000-0000-0000-0000-000000000000');
                            updateLine(idx, 'productNumber', '');
                            updateLine(idx, 'productDescription', '');
                          }}
                        >
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                    )}
                  </td>
                  <td>
                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      line.productDescription || '—'
                    ) : (
                      <input
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                        value={line.productDescription || ''}
                        onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                        placeholder={t('salesOrders.placeholders.customDescription')}
                      />
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      style={{ width: '100%', textAlign: 'right' }}
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      className="input"
                      style={{ width: '100%', fontSize: 13, textAlign: 'right' }}
                      value={line.unitOfMeasure}
                      onChange={(e) => updateLine(idx, 'unitOfMeasure', e.target.value)}
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
                  <td style={{ textAlign: 'right' }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      style={{ width: '100%', textAlign: 'right' }}
                      value={line.discountPercentage}
                      onChange={(e) => updateLine(idx, 'discountPercentage', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <select
                      className="input"
                      style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                      value={line.taxCategoryId || ''}
                      onChange={(e) => updateLine(idx, 'taxCategoryId', e.target.value)}
                    >
                      {taxCategories.map((c) => (
                        <option key={c.taxCategoryId} value={c.taxCategoryId}>
                          {getTaxLabel(c)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatAmount(computeAmount(line), currencyCode)}
                  </td>
                  <td>
                    {lines.length > 1 && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeLine(idx)}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                  >
                    {t('purchaseOrders.noLineItems')}
                  </td>
                </tr>
              )}
              {lines.length > 0 && (() => {
                const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                return (
                  <>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('common.subtotal')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(subtotal, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('common.tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(totalTax, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                      <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {t('common.total')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(subtotal + totalTax, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
        </div>
      </DetailsLayout>
    </>
  );
}
