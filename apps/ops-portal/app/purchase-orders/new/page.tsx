/* eslint-disable i18next/no-literal-string */
'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/shared/OrderTotalsCard';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice } from '@modbm/shared';

interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
}

interface LineItem {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  unitOfMeasure: string;
}

let lineKey = 0;

function emptyLine(): LineItem {
  return {
    key: ++lineKey,
    productId: '',
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0',
    unitOfMeasure: 'EA',
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
  const t = useTranslations();
  const router = useRouter();
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);

  const [vendorId, setVendorId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [name, setName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<LineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Debounced server-side search for suppliers (300ms)
  const searchSuppliers = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setFilteredSuppliers([]); return; }
    try {
      const data = await apiFetch<{ data: Supplier[] }>(
        `/api/suppliers?q=${encodeURIComponent(term)}&limit=10`,
      );
      setFilteredSuppliers(data.data);
    } catch { setFilteredSuppliers([]); }
  }, []);

  const debouncedSupplierSearch = useDebounce(
    (term: unknown) => searchSuppliers(term as string), 300,
  );

  const selectSupplier = (s: Supplier) => {
    setVendorId(s.vendorId);
    setSupplierSearch(`${s.vendorNumber} — ${s.name}`);
    setShowSupplierDropdown(false);
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
        pricePerUnit: parseFloat(p.tradePrice || p.listPrice || '0').toFixed(2),
        unitOfMeasure: 'EA',
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
    setLines((prev) => [...prev, emptyLine()]);
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
    }).amount;
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      setError(t('common.errors.pleaseSelectSupplier'));
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
        invoiceNumber: invoiceNumber || undefined,
        notes: notes || undefined,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            productDescription: l.productDescription,
            quantity: l.quantity,
            pricePerUnit: l.pricePerUnit,
            unitOfMeasure: l.unitOfMeasure,
          })),
      });
      router.push(`/purchase-orders/${order.purchaseOrderId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToCreatePO'));
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = lines.reduce((sum, l) => sum + computeAmount(l), 0);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('purchaseOrders.buttons.createPO')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('purchaseOrders.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/purchase-orders')}
          >
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('common.saving') : t('purchaseOrders.buttons.createPO')}
          </button>
        </div>
      </div>

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

      <div className="scroll-area" style={{ flex: 1 }}>
        {/* Order header */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              <input
                id="order-supplier"
                className="input"
                autoComplete="off"
                placeholder={t('purchaseOrders.placeholders.searchSuppliers')}
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setShowSupplierDropdown(true);
                  setVendorId('');
                  debouncedSupplierSearch(e.target.value);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
              />
              {showSupplierDropdown && supplierSearch && (
                <div
                  className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {filteredSuppliers.slice(0, 10).map((s) => (
                    <div
                      key={s.vendorId}
                      className="px-3 py-2 cursor-pointer text-sm"
                      style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
                      onMouseDown={() => selectSupplier(s)}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {s.vendorNumber}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('common.noMatchingResults')}
                    </div>
                  )}
                </div>
              )}
            </div>

             <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('purchaseOrders.labels.invoiceNumber')}
              </label>
              <input
                id="order-invoice"
                className="input"
                placeholder={t('purchaseOrders.placeholders.invoiceNumber')}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
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
                placeholder="EUR"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              />
            </div>

            </div>
          </div>

        {/* Notes Card */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            id="order-notes"
            className="input w-full"
            style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
            placeholder={t('common.notesCardPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Line items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('purchaseOrders.lineItems')}
            </h3>
            <div className="flex items-center gap-3">
              <ProductSearchInput
                onSelect={addLineFromProduct}
                placeholder={t('purchaseOrders.placeholders.searchProduct')}
                style={{ width: 240 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLine}>
                + {t('purchaseOrders.buttons.blankLine')}
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
                <th style={{ width: 110, textAlign: 'right' }}>{t('purchaseOrders.columns.unitPrice')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('purchaseOrders.columns.amount')}</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                    {line.productId ? (
                      <div className="flex items-center gap-2">
                        <span>{line.productNumber}</span>
                        <button
                          className="text-xs cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => {
                            updateLine(idx, 'productId', '');
                            updateLine(idx, 'productNumber', '');
                            updateLine(idx, 'productDescription', '');
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                    )}
                  </td>
                  <td>{line.productDescription || '—'}</td>
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
                        ✕
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
            </tbody>
          </table>
        </div>

        <OrderTotalsCard
          subtotal={subtotal}
          totalTax={0}
          currencyCode={currencyCode}
        />
      </div>
    </Shell>
  );
}
