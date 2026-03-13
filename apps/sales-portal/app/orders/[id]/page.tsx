'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/orders/OrderTotalsCard';
import ProductSearchInput from '@/components/orders/ProductSearchInput';
import type { Product } from '@/components/orders/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';

interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  amount: string;
  gstCategoryId: string | null;
  tax: string;
  totalAmount: string;
  unitOfMeasure: string;
}

interface GstCategory {
  gstCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

function gstLabel(c: GstCategory): string {
  if (c.type === 'exempt') return 'Exempt';
  if (c.type === 'zero_rated') return 'Zero Rated';
  const pct = parseFloat(c.rate || '0');
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct}% GST`;
}

interface OrderEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actor: string;
  createdOn: string;
}

interface OrderDetail {
  salesOrderId: string | null;
  orderNumber: string;
  name: string | null;
  customerId: string | null;
  customerOrderNumber: string | null;
  stateCode: string;
  currencyCode: string;
  customerDiscount: string | null;
  gstCategoryId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  source?: 'abm' | 'app';
  lines: OrderLine[];
  events: OrderEvent[];
}

interface InventoryLevel {
  inventoryLevelId: string;
  productId: string;
  productNumber: string;
  productName: string;
  locationNo: string;
  locationName: string;
  quantityOnHand: string;
  quantityCommitted: string;
  quantityOnOrder: string;
  quantityAvailable: string;
  quantityReserved: string;
}


const STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'draft', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['shipped', 'confirmed'],
  shipped: ['invoiced'],
  invoiced: [],
  cancelled: ['draft'],
  legacy: [],
};

function StateBadge({ state }: { state: string }) {
  return <span className={`badge badge-${state}`}>{state}</span>;
}

function EventIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    created: '🆕',
    updated: '✏️',
    status_changed: '🔄',
    line_added: '➕',
    line_updated: '📝',
    line_removed: '🗑️',
    quoted: '📨',
    confirmed: '✅',
    cancelled: '❌',
  };
  return <span>{icons[type] || '📌'}</span>;
}



export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source') || 'app';

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  // Editable header fields
  const [editName, setEditName] = useState('');
  const [editPO, setEditPO] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [headerDirty, setHeaderDirty] = useState(false);

  // Add-line product search is handled by shared ProductSearchInput

  // GST categories
  const [gstCategories, setGstCategories] = useState<GstCategory[]>([]);

  // Tab state for line items / availability
  const [activeTab, setActiveTab] = useState<'lines' | 'availability'>('lines');
  const [inventoryData, setInventoryData] = useState<InventoryLevel[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrderDetail>(
        `/api/orders/${encodeURIComponent(id)}?source=${source}`,
      );
      setOrder(data);
      setEditName(data.name || '');
      setEditPO(data.customerOrderNumber || '');
      setEditNotes(data.notes || '');
      setHeaderDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // Load GST categories
    apiFetch<GstCategory[]>('/api/gst-categories').then(setGstCategories).catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id, source]);

  // Load inventory when availability tab is selected
  useEffect(() => {
    if (activeTab !== 'availability' || !order || order.lines.length === 0) return;
    const productIds = [...new Set(order.lines.map((l) => l.productId).filter(Boolean))];
    if (productIds.length === 0) return;
    setInventoryLoading(true);
    apiFetch<{ data: InventoryLevel[] }>(
      `/api/inventory/by-products?productIds=${productIds.join(',')}`,
    )
      .then((res) => setInventoryData(res.data))
      .catch((err) => reportError(err, 'OrderDetailPage'))
      .finally(() => setInventoryLoading(false));
  }, [activeTab, order]);

  // Only draft app orders are editable
  const isEditable = source === 'app' && order?.stateCode === 'draft';

  // Track header changes
  useEffect(() => {
    if (!order) return;
    const changed =
      editName !== (order.name || '') ||
      editPO !== (order.customerOrderNumber || '') ||
      editNotes !== (order.notes || '');
    setHeaderDirty(changed);
  }, [editName, editPO, editNotes, order]);

  // Save header
  const saveHeader = async () => {
    if (!headerDirty) return;
    setSaving(true);
    try {
      await apiMutate(`/api/orders/${id}`, 'PATCH', {
        name: editName || undefined,
        customerOrderNumber: editPO || undefined,
        notes: editNotes || undefined,
      });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  // State transitions
  const changeState = async (newState: string) => {
    try {
      await apiMutate(`/api/orders/${id}/state`, 'PATCH', { stateCode: newState });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change state');
    }
  };

  // Copy order → create new draft with same lines
  const copyOrder = async () => {
    if (!order) return;
    setCopying(true);
    try {
      const newOrder = await apiMutate<{ salesOrderId: string }>('/api/orders', 'POST', {
        name: order.name ? `Copy of ${order.name}` : undefined,
        customerId: order.customerId || undefined,
        customerOrderNumber: order.customerOrderNumber || undefined,
        notes: order.notes || undefined,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          productDescription: l.productDescription,
          quantity: l.quantity,
          pricePerUnit: l.pricePerUnit,
          discountPercentage: l.discountPercentage || '0',
          gstCategoryId: l.gstCategoryId || undefined,
          unitOfMeasure: l.unitOfMeasure || 'EA',
        })),
      });
      router.push(`/orders/${newOrder.salesOrderId}?source=app`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy order');
    } finally {
      setCopying(false);
    }
  };

  // Line editing
  const updateLine = async (lineId: string, field: string, value: string) => {
    setSaving(true);
    try {
      await apiMutate(`/api/orders/${id}/lines/${lineId}`, 'PATCH', { [field]: value });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!confirm('Remove this line item?')) return;
    setSaving(true);
    setError('');
    try {
      await apiMutate(`/api/orders/${id}/lines/${lineId}`, 'DELETE');
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove line');
    } finally {
      setSaving(false);
    }
  };

  const addLineFromProduct = async (p: Product) => {
    setSaving(true);
    try {
      await apiMutate(`/api/orders/${id}/lines`, 'POST', {
        productId: p.productId,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
        discountPercentage: '0',
        unitOfMeasure: 'EA',
      });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>Loading order…</p>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || 'Order not found'}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>
            ← Back to Orders
          </button>
        </div>
      </Shell>
    );
  }

  const allowedTransitions = source === 'app'
    ? (STATE_TRANSITIONS[order.stateCode] || [])
    : [];
  const subtotal = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.amount || '0'), 0,
  );
  const totalTax = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.tax || '0'), 0,
  );

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => router.push('/')}
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              <StateBadge state={order.stateCode} />
              {source === 'abm' && (
                <span className="badge badge-abm">ABM</span>
              )}
              {saving && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Saving…
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {order.name || 'Untitled order'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={copyOrder}
            disabled={copying}
          >
            {copying ? 'Copying…' : '📋 Copy Order'}
          </button>
          {headerDirty && isEditable && (
            <button className="btn btn-primary btn-sm" onClick={saveHeader} disabled={saving}>
              💾 Save
            </button>
          )}
          {allowedTransitions.map((state) => (
            <button
              key={state}
              className={`btn btn-sm ${state === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => changeState(state)}
            >
              → {state}
            </button>
          ))}
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
          <button className="ml-3 text-xs underline" onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="mb-6">
          {/* Order info card */}
          <div className="card col-span-2">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Order Details
            </h3>
            {isEditable ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Customer
                    {order.currencyCode && (
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
                        {order.currencyCode}
                      </span>
                    )}
                    {order.gstCategoryId && (() => {
                      const c = gstCategories.find((g) => g.gstCategoryId === order.gstCategoryId);
                      return c?.type === 'exempt' ? (
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
                          EXEMPT
                        </span>
                      ) : null;
                    })()}
                    {parseFloat(order.customerDiscount || '0') > 0 && (
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
                        {parseFloat(order.customerDiscount!)}% disc
                      </span>
                    )}
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {order.customerId || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Customer PO #
                  </label>
                  <input
                    className="input"
                    value={editPO}
                    onChange={(e) => setEditPO(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Customer purchase order"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Order Name
                  </label>
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Order name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {new Date(order.createdOn).toLocaleString()} by {order.createdBy || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Notes
                  </label>
                  <input
                    className="input"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Internal notes"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Customer
                    {order.currencyCode && (
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
                        {order.currencyCode}
                      </span>
                    )}
                    {order.gstCategoryId && (() => {
                      const c = gstCategories.find((g) => g.gstCategoryId === order.gstCategoryId);
                      return c?.type === 'exempt' ? (
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
                          EXEMPT
                        </span>
                      ) : null;
                    })()}
                    {parseFloat(order.customerDiscount || '0') > 0 && (
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
                        {parseFloat(order.customerDiscount!)}% disc
                      </span>
                    )}
                  </span>
                  <p style={{ fontWeight: 500 }}>{order.customerId || '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Customer PO</span>
                  <p style={{ fontWeight: 500 }}>{order.customerOrderNumber || '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Order Name</span>
                  <p style={{ fontWeight: 500 }}>{order.name || '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Created</span>
                  <p style={{ fontWeight: 500 }}>
                    {order.createdOn
                      ? new Date(order.createdOn).toLocaleString()
                      : '—'}
                    {order.createdBy ? ` by ${order.createdBy}` : ''}
                  </p>
                </div>
                {order.notes && (
                  <div className="col-span-2">
                    <span style={{ color: 'var(--text-muted)' }}>Notes</span>
                    <p style={{ fontWeight: 500 }}>{order.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Line items / Availability tabs */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-0">
              <button
                className="text-sm font-semibold px-3 py-1.5 rounded-l-lg"
                style={{
                  color: activeTab === 'lines' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'lines' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'lines' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('lines')}
              >
                Line Items
              </button>
              <button
                className="text-sm font-semibold px-3 py-1.5 rounded-r-lg"
                style={{
                  color: activeTab === 'availability' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'availability' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'availability' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  borderLeft: activeTab === 'availability' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('availability')}
              >
                📦 Availability
              </button>
            </div>
            {isEditable && activeTab === 'lines' && (
              <ProductSearchInput
                onSelect={addLineFromProduct}
                placeholder="Add product… (search)"
                style={{ width: 240 }}
              />
            )}
          </div>

          {activeTab === 'lines' ? (
          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Product</th>
                <th>Description</th>
                <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: 80, textAlign: 'right' }}>Disc %</th>
                <th style={{ width: 110, textAlign: 'right' }}>GST</th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
                {isEditable && <th style={{ width: 50 }}></th>}
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.salesOrderLineId}>
                  <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                    {line.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  {isEditable ? (
                    <>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="1"
                          style={{ width: '100%', textAlign: 'right' }}
                          defaultValue={line.quantity}
                          key={`qty-${line.salesOrderLineId}-${line.quantity}`}
                          onBlur={(e) => {
                            if (e.target.value !== line.quantity) {
                              updateLine(line.salesOrderLineId, 'quantity', e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          style={{ width: '100%', textAlign: 'right' }}
                          defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                          key={`price-${line.salesOrderLineId}-${line.pricePerUnit}`}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                            e.target.value = formatted;
                            if (formatted !== parseFloat(line.pricePerUnit || '0').toFixed(2)) {
                              updateLine(line.salesOrderLineId, 'pricePerUnit', formatted);
                            }
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
                          defaultValue={line.discountPercentage || '0'}
                          key={`disc-${line.salesOrderLineId}-${line.discountPercentage}`}
                          onBlur={(e) => {
                            if (e.target.value !== (line.discountPercentage || '0')) {
                              updateLine(line.salesOrderLineId, 'discountPercentage', e.target.value);
                            }
                          }}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {line.quantity}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {line.discountPercentage || '0'}%
                      </td>
                    </>
                  )}
                  {isEditable ? (
                    <td style={{ textAlign: 'right' }}>
                      <select
                        className="input"
                        style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                        value={line.gstCategoryId || ''}
                        onChange={(e) => {
                          updateLine(line.salesOrderLineId, 'gstCategoryId', e.target.value);
                        }}
                      >
                        {gstCategories.map((c) => (
                          <option key={c.gstCategoryId} value={c.gstCategoryId}>
                            {gstLabel(c)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td style={{ textAlign: 'right', fontSize: 12 }}>
                      {(() => {
                        const c = gstCategories.find((c) => c.gstCategoryId === line.gstCategoryId);
                        if (c) return gstLabel(c);
                        // ABM legacy: derive effective rate from tax / amount
                        const amt = parseFloat(line.amount || '0');
                        const tax = parseFloat(line.tax || '0');
                        if (amt > 0 && tax > 0) {
                          const pct = (tax / amt) * 100;
                          return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                        }
                        if (amt > 0 && tax === 0) return 'Exempt';
                        return '—';
                      })()}
                    </td>
                  )}
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatAmount(parseFloat(line.amount || '0'), order.currencyCode || 'EUR')}
                  </td>
                  {isEditable && (
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeLine(line.salesOrderLineId)}
                        title="Remove line"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {order.lines.length === 0 && (
                <tr>
                  <td
                    colSpan={isEditable ? 9 : 8}
                    style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                  >
                    No line items — use the search above to add products
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          ) : (
            /* Availability tab */
            inventoryLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Loading inventory data…</p>
            ) : (
              <table className="table-lines">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Ordered</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Location</th>
                    <th style={{ width: 90, textAlign: 'right' }}>On Hand</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Committed</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Reserved</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Available</th>
                    <th style={{ width: 70, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const lineInventory = inventoryData.filter(
                      (inv) => inv.productId === line.productId,
                    );
                    const totalAvail = lineInventory.reduce(
                      (sum, inv) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                    );
                    const orderedQty = parseFloat(line.quantity || '0');
                    const canFulfil = totalAvail >= orderedQty;

                    if (lineInventory.length === 0) {
                      return (
                        <tr key={line.salesOrderLineId}>
                          <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                          <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                            {line.productId?.substring(0, 8) || '—'}
                          </td>
                          <td>{line.productDescription || '—'}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            No inventory data
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⚠</span>
                          </td>
                        </tr>
                      );
                    }

                    return lineInventory.map((inv, idx) => {
                      const avail = parseFloat(inv.quantityAvailable || '0');
                      return (
                        <tr key={`${line.salesOrderLineId}-${inv.inventoryLevelId}`}>
                          {idx === 0 && (
                            <>
                              <td style={{ color: 'var(--text-muted)' }} rowSpan={lineInventory.length}>{line.lineNumber}</td>
                              <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }} rowSpan={lineInventory.length}>
                                {line.productId?.substring(0, 8) || '—'}
                              </td>
                              <td rowSpan={lineInventory.length}>{line.productDescription || '—'}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} rowSpan={lineInventory.length}>
                                {line.quantity}
                              </td>
                            </>
                          )}
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{inv.locationName || inv.locationNo}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityOnHand || '0')}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityCommitted || '0')}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityReserved || '0')}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: avail > 0 ? '#4ade80' : '#ef4444',
                          }}>
                            {avail}
                          </td>
                          {idx === 0 && (
                            <td style={{ textAlign: 'center' }} rowSpan={lineInventory.length}>
                              <span style={{
                                color: canFulfil ? '#4ade80' : '#ef4444',
                                fontWeight: 700,
                                fontSize: 11,
                              }}>
                                {canFulfil ? '✓' : '✗'}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })}
                  {order.lines.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          )}
        </div>

        <OrderTotalsCard subtotal={subtotal} totalTax={totalTax} currencyCode={order.currencyCode || 'EUR'} />

        {/* Audit timeline — only for app orders */}
        {source === 'app' && (
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Activity Timeline
            </h3>
            <div className="space-y-3">
              {[...order.events].reverse().map((event) => {
                const hasPayload = event.payload && Object.keys(event.payload).length > 0;
                return (
                  <details
                    key={event.eventId}
                    className="text-sm"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(30,58,95,0.3)',
                    }}
                  >
                    <summary
                      className="flex items-center gap-3"
                      style={{ cursor: hasPayload ? 'pointer' : 'default', userSelect: 'none', listStyle: 'none' }}
                    >
                      <EventIcon type={event.eventType} />
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {event.eventType.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        by {event.actor}
                      </span>
                      <span className="ml-auto text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(event.createdOn).toLocaleString()}
                      </span>
                      {hasPayload && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>▶</span>
                      )}
                    </summary>
                    {hasPayload && (
                      <div
                        className="mt-2 text-xs grid gap-y-1"
                        style={{ marginLeft: 28, color: 'var(--text-secondary)' }}
                      >
                        {Object.entries(event.payload).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span style={{ color: 'var(--text-muted)', minWidth: 100, fontWeight: 500 }}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {typeof value === 'object' && value !== null
                                ? Object.entries(value as Record<string, unknown>)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                );
              })}
              {order.events.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No events recorded
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
