'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/purchase-orders/OrderTotalsCard';
import ProductSearchInput from '@/components/purchase-orders/ProductSearchInput';
import type { Product } from '@/components/purchase-orders/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';

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
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.pricePerUnit) || 0;
    return qty * price;
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      setError('Please select a supplier');
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId)) {
      setError('Please add at least one line item with a product');
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
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = lines.reduce((sum, l) => sum + computeAmount(l), 0);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">New Purchase Order</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Create a purchase order
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/')}
          >
            Cancel
          </button>
          <button
            id="btn-submit-order"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Creating…' : '✅ Create Order'}
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
        <div className="card mb-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Order Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Supplier *
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
                placeholder="Search supplier…"
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
                      No matching suppliers
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Invoice #
              </label>
              <input
                id="order-invoice"
                className="input"
                placeholder="Supplier invoice reference"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Order Name
              </label>
              <input
                id="order-name"
                className="input"
                placeholder="Descriptive title (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Currency
              </label>
              <input
                id="order-currency"
                className="input"
                placeholder="EUR"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Notes
              </label>
              <input
                id="order-notes"
                className="input"
                placeholder="Internal notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Line Items
            </h3>
            <div className="flex items-center gap-3">
              <ProductSearchInput
                onSelect={addLineFromProduct}
                placeholder="Add product… (search)"
                style={{ width: 240 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLine}>
                ➕ Blank Line
              </button>
            </div>
          </div>

          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Product</th>
                <th>Description</th>
                <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
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
                    No line items — use the search above to add products
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
