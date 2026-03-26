'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice } from '@modbm/shared';

interface Account {
  accountId: string;
  accountNumber: string;
  name: string;
  customerDiscount: string | null;
  currencyCode: string | null;
  gstPosition: string | null;
}

interface GstCategory {
  gstCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

function getGstLabel(category: GstCategory) {
    const pct = parseFloat(category.rate || '0');
    const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
    return `${category.title} (${formattedPct}%)`;
}

interface LineItem {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  gstCategoryId: string;
  unitOfMeasure: string;
}

let lineKey = 0;

function emptyLine(defaultDiscount = '0', defaultGstCategoryId = ''): LineItem {
  const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
  return {
    key: ++lineKey,
    productId: CUSTOM_LINE_ID,
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0',
    discountPercentage: defaultDiscount,
    gstCategoryId: defaultGstCategoryId,
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

export default function NewOrderPage() {
  const tSales = useTranslations();
  const router = useRouter();
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDiscount, setCustomerDiscount] = useState('0');
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [customerGstPosition, setCustomerGstPosition] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [name, setName] = useState('');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [gstCategories, setGstCategories] = useState<GstCategory[]>([]);
  const defaultGstCategoryId = gstCategories.find((c) => c.isDefault)?.gstCategoryId || '';
  const exemptGstCategoryId = gstCategories.find((c) => c.type === 'exempt')?.gstCategoryId || '';
  const isCustomerExempt = customerGstPosition?.toLowerCase() === 'exempt';
  // Exempt customers always get the exempt GST category
  const effectiveGstCategoryId = isCustomerExempt ? exemptGstCategoryId : defaultGstCategoryId;

  const [lines, setLines] = useState<LineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load GST categories on mount
  useEffect(() => {
    apiFetch<GstCategory[]>('/api/gst-categories')
      .then(setGstCategories)
      .catch((err) => reportError(err, 'NewOrderPage'));
  }, []);

  // When GST categories load or customer changes, backfill effective GST onto lines missing one
  useEffect(() => {
    if (!effectiveGstCategoryId) return;
    setLines((prev) =>
      prev.map((l) => (l.gstCategoryId ? l : { ...l, gstCategoryId: effectiveGstCategoryId })),
    );
  }, [effectiveGstCategoryId]);

  // Debounced server-side search for customers (300ms)
  const searchAccounts = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setFilteredAccounts([]); return; }
    try {
      const data = await apiFetch<{ data: Account[] }>(
        `/api/accounts?q=${encodeURIComponent(term)}&limit=10`,
      );
      setFilteredAccounts(data.data);
    } catch { setFilteredAccounts([]); }
  }, []);

  const debouncedAccountSearch = useDebounce(
    (term: unknown) => searchAccounts(term as string), 300,
  );

  const selectCustomer = (a: Account) => {
    setCustomerId(a.accountId);
    setCustomerSearch(`${a.accountNumber} — ${a.name}`);
    setShowCustomerDropdown(false);
    const disc = a.customerDiscount ?? '0';
    setCustomerDiscount(disc);
    const resolvedCurrency = a.currencyCode || 'EUR';
    setCurrencyCode(resolvedCurrency);
    setCustomerGstPosition(a.gstPosition);

    // Resolve the GST category: exempt customers force all lines to exempt
    const custExempt = a.gstPosition?.toLowerCase() === 'exempt';
    const lineGstId = custExempt ? exemptGstCategoryId : defaultGstCategoryId;

    // Update discount + GST on all existing lines
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        discountPercentage: l.discountPercentage === '0' ? disc : l.discountPercentage,
        gstCategoryId: custExempt ? lineGstId : l.gstCategoryId,
      })),
    );
  };

  const addLineFromProduct = (p: Product) => {
    if (lines.some((l) => l.productId === p.productId)) {
      setError(tSales('toast.productAlreadyInOrder', { productNumber: p.productNumber }));
      return;
    }
    setError('');
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey,
        productId: p.productId,
        productNumber: p.productNumber,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
        discountPercentage: customerDiscount,
        gstCategoryId: effectiveGstCategoryId,
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
    setLines((prev) => [...prev, emptyLine(customerDiscount, effectiveGstCategoryId)]);
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
    }).amount;
  };

  const computeTax = (line: LineItem) => {
    const cat = gstCategories.find((c) => c.gstCategoryId === line.gstCategoryId);
    const rate = cat ? parseFloat(cat.rate || '0') : 0;
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
      taxRate: rate,
    }).tax;
  };

  const handleSubmit = async () => {
    if (!customerId) {
      setError(tSales('common.errors.pleaseSelectCustomer'));
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId)) {
      setError(tSales('common.errors.pleaseAddLineItem'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const order = await apiMutate<{ salesOrderId: string }>('/api/sales-orders', 'POST', {
        name: name || undefined,
        customerId,
        customerOrderNumber: customerOrderNumber || undefined,
        notes: notes || undefined,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            productDescription: l.productDescription,
            quantity: l.quantity,
            pricePerUnit: l.pricePerUnit,
            discountPercentage: l.discountPercentage,
            gstCategoryId: l.gstCategoryId || undefined,
            unitOfMeasure: l.unitOfMeasure,
          })),
      });
      router.push(`/sales-orders/${order.salesOrderId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tSales('common.errors.failedToCreateOrder'));
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = lines.reduce((sum, l) => sum + computeAmount(l), 0);
  const totalTax = lines.reduce((sum, l) => sum + computeTax(l), 0);

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title="Create Sales Order"
            onBack={() => router.push('/sales-orders')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/sales-orders')}
                  disabled={submitting}
                >
                  {tSales('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? tSales('common.saving') : tSales('salesOrders.buttons.createOrder')}
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
            <span className="material-symbols-outlined">receipt_long</span>
            {tSales('salesOrders.orderDetails')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Customer selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {tSales('salesOrders.labels.customer')} *
                {customerId && (
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
                {isCustomerExempt && (
                    <span
                      style={{
                        marginLeft: 4,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(245,158,11,0.15)',
                        color: '#f59e0b',
                        fontWeight: 600,
                        fontSize: 10,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {tSales('common.gst.exempt')}
                    </span>
                )}
                {customerId && parseFloat(customerDiscount) > 0 && (
                    <span
                      style={{
                        marginLeft: 4,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(74,222,128,0.15)',
                        color: '#4ade80',
                        fontWeight: 600,
                        fontSize: 10,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {tSales('salesOrders.discountPercent', { disc: parseFloat(customerDiscount) })}
                    </span>
                )}
              </label>
              <input
                id="order-customer"
                className="input"
                autoComplete="off"
                placeholder={tSales('salesOrders.placeholders.searchCustomers')}
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  setCustomerId('');
                  debouncedAccountSearch(e.target.value);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && customerSearch && (
                <div
                  className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {filteredAccounts.slice(0, 10).map((a) => (
                    <div
                      key={a.accountId}
                      className="px-3 py-2 cursor-pointer text-sm"
                      style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
                      onMouseDown={() => selectCustomer(a)}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {a.accountNumber}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                        {a.name}
                      </span>
                    </div>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {tSales('common.noMatchingResults')}
                    </div>
                  )}
                </div>
              )}
            </div>

             <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tSales('salesOrders.labels.customerPO')}
              </label>
              <input
                id="order-po"
                className="input"
                placeholder={tSales('salesOrders.placeholders.customerPO')}
                value={customerOrderNumber}
                onChange={(e) => setCustomerOrderNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tSales('salesOrders.labels.orderName')}
              </label>
              <input
                id="order-name"
                className="input"
                placeholder={tSales('salesOrders.placeholders.orderName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tSales('common.notesCardHeading')}
              </label>
              <textarea
                id="order-notes"
                className="input w-full"
                style={{ minHeight: 80, paddingTop: 12, resize: 'vertical' }}
                placeholder={tSales('common.notesCardPlaceholder')}
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
              <span className="material-symbols-outlined">list</span>
              {tSales('salesOrders.lineItems')}
            </h3>
            <div className="flex items-center gap-3">
              <ProductSearchInput
                onSelect={addLineFromProduct}
                placeholder={tSales('salesOrders.placeholders.searchProduct')}
                style={{ width: 240 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLine}>
                + {tSales('salesOrders.buttons.customLine')}
              </button>
            </div>
          </div>

          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>{tSales('salesOrders.columns.lineNumber')}</th>
                <th>{tSales('salesOrders.columns.product')}</th>
                <th>{tSales('salesOrders.columns.description')}</th>
                <th style={{ width: 90, textAlign: 'right' }}>{tSales('salesOrders.columns.qty')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{tSales('salesOrders.columns.unitPrice')}</th>
                <th style={{ width: 80, textAlign: 'right' }}>{tSales('salesOrders.columns.discountPct')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{tSales('salesOrders.columns.gst')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{tSales('salesOrders.columns.amount')}</th>
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
                          ✕
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
                        placeholder="Custom description..."
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
                      value={line.gstCategoryId}
                      onChange={(e) => updateLine(idx, 'gstCategoryId', e.target.value)}
                    >
                      {gstCategories.map((c) => (
                        <option key={c.gstCategoryId} value={c.gstCategoryId}>
                          {getGstLabel(c)}
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
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                  >
                    {tSales('salesOrders.noLineItems')}
                  </td>
                </tr>
              )}
              {lines.length > 0 && (() => {
                const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                return (
                  <>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {tSales('common.subtotal')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(subtotal, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {tSales('common.tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(totalTax, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {tSales('common.total')}
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
