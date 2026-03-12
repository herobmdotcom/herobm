'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/orders/OrderTotalsCard';
import { apiFetch, apiMutate } from '@/lib/api';

interface Account {
  accountId: string;
  accountNumber: string;
  name: string;
  customerDiscount: string | null;
}

interface Product {
  productId: string;
  productNumber: string;
  name: string;
  listPrice: string;
  tradePrice: string;
}

interface LineItem {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  unitOfMeasure: string;
}

let lineKey = 0;

function emptyLine(defaultDiscount = '0'): LineItem {
  return {
    key: ++lineKey,
    productId: '',
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0',
    discountPercentage: defaultDiscount,
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
  const router = useRouter();
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDiscount, setCustomerDiscount] = useState('0');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [name, setName] = useState('');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const [productSearch, setProductSearch] = useState('');
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Debounced server-side search for customers (300ms)
  const searchAccounts = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setFilteredAccounts([]); return; }
    try {
      const data = await apiFetch<{ data: Account[] }>(
        `/api/accounts?search=${encodeURIComponent(term)}&limit=10`,
      );
      setFilteredAccounts(data.data);
    } catch { setFilteredAccounts([]); }
  }, []);

  const debouncedAccountSearch = useDebounce(
    (term: unknown) => searchAccounts(term as string), 300,
  );

  // Debounced server-side search for products (300ms)
  const searchProducts = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setFilteredProducts([]); return; }
    try {
      const data = await apiFetch<{ data: Product[] }>(
        `/api/products?search=${encodeURIComponent(term)}&limit=10`,
      );
      setFilteredProducts(data.data);
    } catch { setFilteredProducts([]); }
  }, []);

  const debouncedProductSearch = useDebounce(
    (term: unknown) => searchProducts(term as string), 300,
  );

  const selectCustomer = (a: Account) => {
    setCustomerId(a.accountId);
    setCustomerSearch(`${a.accountNumber} — ${a.name}`);
    setShowCustomerDropdown(false);
    const disc = a.customerDiscount ?? '0';
    setCustomerDiscount(disc);
    // Update discount on all existing lines that still have default '0'
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        discountPercentage: l.discountPercentage === '0' ? disc : l.discountPercentage,
      })),
    );
  };

  const selectProduct = (p: Product, lineIdx: number) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              productId: p.productId,
              productNumber: p.productNumber,
              productDescription: p.name,
              pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
            }
          : l,
      ),
    );
    setShowProductDropdown(false);
    setProductSearch('');
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
    setLines((prev) => [...prev, emptyLine(customerDiscount)]);
  };

  const computeAmount = (line: LineItem) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.pricePerUnit) || 0;
    const disc = parseFloat(line.discountPercentage) || 0;
    return qty * price * (1 - disc / 100);
  };

  const handleSubmit = async () => {
    if (!customerId) {
      setError('Please select a customer');
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId)) {
      setError('Please add at least one line item with a product');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const order = await apiMutate<{ salesOrderId: string }>('/api/orders', 'POST', {
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
            unitOfMeasure: l.unitOfMeasure,
          })),
      });
      router.push(`/orders/${order.salesOrderId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Create a sales order
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
            {/* Customer selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Customer *
              </label>
              <input
                id="order-customer"
                className="input"
                placeholder="Search customer…"
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
                      No matching customers
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Customer PO #
              </label>
              <input
                id="order-po"
                className="input"
                placeholder="Customer's purchase order reference"
                value={customerOrderNumber}
                onChange={(e) => setCustomerOrderNumber(e.target.value)}
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
            <button className="btn btn-secondary btn-sm" onClick={addLine}>
              ➕ Add Line
            </button>
          </div>

          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Product</th>
                <th style={{ width: 90 }}>Qty</th>
                <th style={{ width: 110 }}>Unit Price</th>
                <th style={{ width: 80 }}>Disc %</th>
                <th style={{ width: 110 }}>Amount</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    <div className="relative">
                      {line.productId ? (
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                            {line.productNumber}
                          </span>
                          <span className="text-sm">{line.productDescription}</span>
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
                        <>
                          <input
                            className="input"
                            placeholder="Search product…"
                            value={activeLine === idx ? productSearch : ''}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setActiveLine(idx);
                              setShowProductDropdown(true);
                              debouncedProductSearch(e.target.value);
                            }}
                            onFocus={() => {
                              setActiveLine(idx);
                              setShowProductDropdown(true);
                            }}
                            onBlur={() =>
                              setTimeout(() => setShowProductDropdown(false), 200)
                            }
                          />
                          {showProductDropdown && activeLine === idx && productSearch && (
                            <div
                              className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-40 scroll-area"
                              style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                              }}
                            >
                              {filteredProducts.slice(0, 8).map((p) => (
                                <div
                                  key={p.productId}
                                  className="px-3 py-2 cursor-pointer text-sm"
                                  style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
                                  onMouseDown={() => selectProduct(p, idx)}
                                >
                                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                    {p.productNumber}
                                  </span>
                                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                                    {p.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
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
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.discountPercentage}
                      onChange={(e) => updateLine(idx, 'discountPercentage', e.target.value)}
                    />
                  </td>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ${computeAmount(line).toFixed(2)}
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
            </tbody>
          </table>
        </div>

        <OrderTotalsCard
          subtotal={lines.reduce((sum, l) => sum + computeAmount(l), 0)}
          totalTax={0}
        />
      </div>
    </Shell>
  );
}
