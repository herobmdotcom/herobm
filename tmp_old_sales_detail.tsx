'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/sales-orders/OrderTotalsCard';
import ProductSearchInput from '@/components/sales-orders/ProductSearchInput';
import type { Product } from '@/components/sales-orders/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';

import PickingSection from '@/components/sales-orders/PickingSection';

interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productNumber?: string;
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
  customerName: string | null;
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

interface ReturnLine {
  returnLineId: string;
  salesOrderLineId: string;
  quantityReturned: string;
  reason: string | null;
  returnFee: string;
}

interface OrderReturn {
  returnId: string;
  returnNumber: string;
  salesOrderId: string;
  stateCode: string;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  lines: ReturnLine[];
}

const RETURN_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['processed', 'draft'],
  processed: [],
  cancelled: [],
};

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

const ORDER_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, quoted: 2, confirmed: 3,
  picking: 4, shipped: 5, invoiced: 6, legacy: 7,
};

const RETURN_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, confirmed: 2, processed: 3,
};

function isBackTransition(
  from: string, to: string,
  lifecycle: Record<string, number> = ORDER_LIFECYCLE,
): boolean {
  return (lifecycle[to] ?? 99) < (lifecycle[from] ?? 99) && to !== 'cancelled';
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }



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
    shipment_created: '🚚',
    shipment_updated: '🚚',
    shipment_dispatched: '🚚',
    shipment_status_changed: '🔄',
    shipment_line_added: '🚚',
    shipment_line_updated: '🚚',
    shipment_line_removed: '🚚',
    picking_line_updated: '🧺',
    picking_line_picked_all: '🧺',
    picking_order_picked_all: '🧺',
    return_created: '↩️',
    return_updated: '✏️',
    return_status_changed: '🔄',
    return_processed: '✅',
    return_line_added: '➕',
    return_line_updated: '✏️',
    return_line_removed: '🗑️',
  };
  return <span>{icons[type] || '📌'}</span>;
}

function ReturnStateBadge({ state }: { state: string }) {
  return <span className={`badge badge-return-${state}`}>{state}</span>;
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

  // Returns state
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [showCreateReturn, setShowCreateReturn] = useState(false);
  const [newReturnNotes, setNewReturnNotes] = useState('');
  const [newReturnLines, setNewReturnLines] = useState<Array<{
    salesOrderLineId: string;
    quantityReturned: string;
    reason: string;
    returnFee: string;
    feeMode: 'absolute' | 'percentage';
    originalAmount: number;
  }>>([])

  // Toast notification state
  const [toastData, setToastData] = useState<{ message: React.ReactNode } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: React.ReactNode) => {
    setToastData({ message });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastData(null), 6000);
  };

  const loadOrder = async (autoTransitions?: any[], showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch<OrderDetail>(
        `/api/sales-orders/${encodeURIComponent(id)}?source=${source}`,
      );
      setOrder(data);
      setEditName(data.name || '');
      setEditPO(data.customerOrderNumber || '');
      setEditNotes(data.notes || '');
      setHeaderDirty(false);

      if (autoTransitions && autoTransitions.length > 0) {
        showToast(
          <>Automatically moved to <strong>{cap(autoTransitions[0].to)}</strong> because {autoTransitions[0].reason.toLowerCase()}.</>
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const loadReturns = async () => {
    setReturnsLoading(true);
    try {
      const data = await apiFetch<OrderReturn[]>(`/api/sales-orders/${encodeURIComponent(id)}/returns`);
      setReturns(data);
    } catch (err) {
      // Returns might not exist yet, that's fine
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // Load GST categories
    apiFetch<GstCategory[]>('/api/gst-categories').then(setGstCategories).catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id, source]);

  // Load returns when order is invoiced
  useEffect(() => {
    if (order?.stateCode === 'invoiced' || order?.stateCode === 'legacy') {
      loadReturns();
    }
  }, [order?.stateCode, source]);

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

  // Order details (name, PO, notes) editable until cancelled
  const isOrderDetailsEditable = source === 'app'
    && !['cancelled', 'legacy'].includes(order?.stateCode ?? '');

  // Line items only editable in draft
  const isOrderLinesEditable = source === 'app'
    && order?.stateCode === 'draft';

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
      await apiMutate(`/api/sales-orders/${id}`, 'PATCH', {
        name: editName || undefined,
        customerOrderNumber: editPO || undefined,
        notes: editNotes || undefined,
      });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  // State transitions
  const changeState = async (newState: string) => {
    try {
      await apiMutate(`/api/sales-orders/${id}/state`, 'PATCH', { stateCode: newState });
      showToast(<>Order moved to <strong>{cap(newState)}</strong></>);
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change state');
    }
  };

  // Copy order → create new draft with same lines
  const copyOrder = async () => {
    if (!order) return;
    setCopying(true);
    try {
      const newOrder = await apiMutate<{ salesOrderId: string }>('/api/sales-orders', 'POST', {
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
      router.push(`/sales-orders/${newOrder.salesOrderId}?source=app`);
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
      await apiMutate(`/api/sales-orders/${id}/lines/${lineId}`, 'PATCH', { [field]: value });
      await loadOrder(undefined, false);
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
      await apiMutate(`/api/sales-orders/${id}/lines/${lineId}`, 'DELETE');
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove line');
    } finally {
      setSaving(false);
    }
  };

  const addLineFromProduct = async (p: Product) => {
    if (order.lines.some((l) => l.productId === p.productId)) {
      showToast(
        <span style={{ color: '#f87171' }}>
          Product <strong>{p.productNumber}</strong> is already present in this order.
        </span>
      );
      return;
    }

    setSaving(true);
    try {
      await apiMutate(`/api/sales-orders/${id}/lines`, 'POST', {
        productId: p.productId,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
        discountPercentage: '0',
        unitOfMeasure: 'EA',
      });
      await loadOrder(undefined, false);
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
          {(order.stateCode === 'draft' || order.stateCode === 'quoted') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const { getToken } = await import('@/lib/api');
                  const t = getToken();
                  if (!t) return;
                  const res = await fetch(`/api/sales-orders/${id}/sales-quote-report?source=${source}`, {
                    headers: { Authorization: `Bearer ${t}` },
                  });
                  if (!res.ok) throw new Error(`Failed to generate quote: ${res.status}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                } catch (err) {
                  reportError(err, 'OrderDetailPage:generateQuote');
                  setError(err instanceof Error ? err.message : 'Failed to generate quote');
                }
              }}
            >
              📄 Create Quote
            </button>
          )}
          {(order.stateCode === 'picking' || order.stateCode === 'shipped' || order.stateCode === 'invoiced') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const { getToken } = await import('@/lib/api');
                  const t = getToken();
                  if (!t) return;
                  const res = await fetch(`/api/sales-orders/${id}/sales-invoice-report?source=${source}`, {
                    headers: { Authorization: `Bearer ${t}` },
                  });
                  if (!res.ok) throw new Error(`Failed to generate invoice: ${res.status}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                } catch (err) {
                  const { reportError } = await import('@/lib/api');
                  reportError(err, 'OrderDetailPage:generateInvoice');
                  setError(err instanceof Error ? err.message : 'Failed to generate invoice');
                }
              }}
            >
              📄 Create Invoice
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={copyOrder}
            disabled={copying}
          >
            {copying ? 'Copying…' : '📋 Copy Order'}
          </button>
          {(order.stateCode === 'invoiced' || order.stateCode === 'legacy') && !showCreateReturn && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowCreateReturn(true);
                setNewReturnLines(
                  order.lines.map((l) => ({
                    salesOrderLineId: l.salesOrderLineId,
                    quantityReturned: '',
                    reason: '',
                    returnFee: '0',
                    feeMode: 'absolute' as const,
                    originalAmount: parseFloat(l.amount || '0'),
                  })),
                );
              }}
            >
              ↩ Create Return
            </button>
          )}
          {headerDirty && isOrderDetailsEditable && (
            <button className="btn btn-primary btn-sm" onClick={saveHeader} disabled={saving}>
              💾 Save
            </button>
          )}
          {[...allowedTransitions]
            .sort((a, b) => {
              const aBack = isBackTransition(order.stateCode, a);
              const bBack = isBackTransition(order.stateCode, b);
              if (aBack !== bBack) return aBack ? -1 : 1;
              return 0;
            })
            .map((state) => {
              const back = isBackTransition(order.stateCode, state);
              return (
                <button
                  key={state}
                  className={`btn btn-sm ${state === 'cancelled' ? 'btn-danger' : back ? 'btn-secondary' : 'btn-primary'
                    }`}
                  onClick={() => changeState(state)}
                >
                  {state === 'cancelled' ? `✕ ${cap(state)}` : back ? `← ${cap(state)}` : `→ ${cap(state)}`}
                </button>
              );
            })}
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
                    {order.customerName ? `${order.customerName} (${order.customerId})` : order.customerId || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {new Date(order.createdOn).toLocaleString()} by {order.createdBy || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Order Name
                  </label>
                  <input
                    className="input"
                    disabled={!isOrderDetailsEditable}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Order name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Customer PO #
                  </label>
                  <input
                    className="input"
                    disabled={!isOrderDetailsEditable}
                    value={editPO}
                    onChange={(e) => setEditPO(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Customer purchase order"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Notes
                  </label>
                  <input
                    className="input"
                    disabled={!isOrderDetailsEditable}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="Internal notes"
                  />
                </div>
              </div>
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
            {isOrderLinesEditable && activeTab === 'lines' && (
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
                  {isOrderLinesEditable && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.salesOrderLineId}>
                    <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                      {line.productNumber || line.productId?.substring(0, 8) || '—'}
                    </td>
                    <td>{line.productDescription || '—'}</td>
                    {isOrderLinesEditable ? (
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
                    {isOrderLinesEditable ? (
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
                    {isOrderLinesEditable && (
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
                      colSpan={isOrderLinesEditable ? 9 : 8}
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
                          <td style={{ fontWeight: 600, fontSize: 12 }}>
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
                              <td style={{ fontWeight: 600, fontSize: 12 }} rowSpan={lineInventory.length}>
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

        {/* Picking section */}
        <PickingSection
          orderId={order.salesOrderId || id}
          orderState={order.stateCode}
          orderLines={order.lines}
          onOrderUpdated={() => loadOrder(undefined, false)}
        />

        {/* Returns section — only shown when returns exist or creating one */}
        {(order.stateCode === 'invoiced' || order.stateCode === 'legacy') && (returns.length > 0 || showCreateReturn) && (
          <div className="card mb-6">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              ↩ Returns
            </h3>

            {/* Create return form */}
            {showCreateReturn && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(168, 85, 247, 0.05)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#c084fc' }}>
                    New Return
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowCreateReturn(false);
                        setNewReturnLines([]);
                        setNewReturnNotes('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={saving || newReturnLines.every((l) => !l.quantityReturned || parseFloat(l.quantityReturned) <= 0)}
                      onClick={async () => {
                        setSaving(true);
                        setError('');
                        try {
                          const lines = newReturnLines
                            .filter((l) => l.quantityReturned && parseFloat(l.quantityReturned) > 0)
                            .map((l) => ({
                              salesOrderLineId: l.salesOrderLineId,
                              quantityReturned: l.quantityReturned,
                              reason: l.reason || undefined,
                              returnFee: l.returnFee || '0',
                            }));
                          await apiMutate(`/api/sales-orders/${id}/returns`, 'POST', {
                            notes: newReturnNotes || undefined,
                            lines,
                          });
                          setShowCreateReturn(false);
                          setNewReturnLines([]);
                          setNewReturnNotes('');
                          await loadReturns();
                          await loadOrder(undefined, false);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to create return');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      💾 Create Return
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Notes
                  </label>
                  <input
                    className="input"
                    value={newReturnNotes}
                    onChange={(e) => setNewReturnNotes(e.target.value)}
                    placeholder="Return reason / notes"
                  />
                </div>

                <table className="table-lines">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Product</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Original Qty</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Return Qty</th>
                      <th style={{ width: 180 }}>Reason</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line, idx) => {
                      const rl = newReturnLines[idx];
                      if (!rl) return null;
                      return (
                        <tr key={line.salesOrderLineId}>
                          <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>
                              {line.productNumber || line.productId?.substring(0, 8) || '—'}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                              {line.productDescription || ''}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {line.quantity}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              max={line.quantity}
                              step="1"
                              style={{ width: '100%', textAlign: 'right' }}
                              value={rl.quantityReturned}
                              onChange={(e) => {
                                const updated = [...newReturnLines];
                                updated[idx] = { ...rl, quantityReturned: e.target.value };
                                setNewReturnLines(updated);
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              style={{ width: '100%' }}
                              value={rl.reason}
                              onChange={(e) => {
                                const updated = [...newReturnLines];
                                updated[idx] = { ...rl, reason: e.target.value };
                                setNewReturnLines(updated);
                              }}
                              placeholder="Reason"
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex items-center gap-1">
                              <select
                                className="input"
                                style={{ width: 50, fontSize: 11, padding: '4px 6px' }}
                                value={rl.feeMode}
                                onChange={(e) => {
                                  const updated = [...newReturnLines];
                                  const mode = e.target.value as 'absolute' | 'percentage';
                                  if (mode === 'percentage' && rl.feeMode === 'absolute') {
                                    // Convert absolute to percentage for display
                                    const pct = rl.originalAmount > 0
                                      ? ((parseFloat(rl.returnFee || '0') / rl.originalAmount) * 100).toFixed(1)
                                      : '0';
                                    updated[idx] = { ...rl, feeMode: mode, returnFee: pct };
                                  } else if (mode === 'absolute' && rl.feeMode === 'percentage') {
                                    // Convert percentage to absolute for storage
                                    const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                    updated[idx] = { ...rl, feeMode: mode, returnFee: abs };
                                  }
                                  setNewReturnLines(updated);
                                }}
                              >
                                <option value="absolute">$</option>
                                <option value="percentage">%</option>
                              </select>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ width: 80, textAlign: 'right' }}
                                value={rl.returnFee}
                                onChange={(e) => {
                                  const updated = [...newReturnLines];
                                  updated[idx] = { ...rl, returnFee: e.target.value };
                                  setNewReturnLines(updated);
                                }}
                                onBlur={() => {
                                  // If in percentage mode, convert to absolute for storage
                                  if (rl.feeMode === 'percentage') {
                                    const updated = [...newReturnLines];
                                    const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                    updated[idx] = { ...rl, feeMode: 'absolute', returnFee: abs };
                                    setNewReturnLines(updated);
                                  }
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Existing returns list */}
            {returnsLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading returns…</p>
            ) : returns.length === 0 && !showCreateReturn ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No returns recorded</p>
            ) : (
              <div className="space-y-3">
                {returns.map((ret) => {
                  const allowedRetTransitions = RETURN_STATE_TRANSITIONS[ret.stateCode] || [];
                  const isRetEditable = ret.stateCode === 'draft';
                  return (
                    <div
                      key={ret.returnId}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{ret.returnNumber}</span>
                          <ReturnStateBadge state={ret.stateCode} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(ret.createdOn).toLocaleString()}
                            {ret.createdBy && ` by ${ret.createdBy}`}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {allowedRetTransitions.map((s) => (
                            <button
                              key={s}
                              className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                              onClick={async () => {
                                try {
                                  await apiMutate(`/api/sales-orders/${id}/returns/${ret.returnId}/state`, 'PATCH', { stateCode: s });
                                  await loadReturns();
                                  await loadOrder(undefined, false);
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'Failed to change return state');
                                }
                              }}
                            >
                              → {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {ret.notes && (
                        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                          {ret.notes}
                        </p>
                      )}

                      <table className="table-lines">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ width: 90, textAlign: 'right' }}>Qty Returned</th>
                            <th style={{ width: 180 }}>Reason</th>
                            <th style={{ width: 100, textAlign: 'right' }}>Fee</th>
                            <th style={{ width: 100, textAlign: 'right' }}>Amount</th>
                            {isRetEditable && <th style={{ width: 50 }}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {ret.lines.map((rl) => {
                            const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                            return (
                              <tr key={rl.returnLineId}>
                                <td>
                                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                                    {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                  </span>
                                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {origLine?.productDescription || ''}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {isRetEditable ? (
                                    <input
                                      className="input"
                                      type="number"
                                      min="1"
                                      step="1"
                                      style={{ width: '100%', textAlign: 'right' }}
                                      defaultValue={rl.quantityReturned}
                                      key={`retqty-${rl.returnLineId}-${rl.quantityReturned}`}
                                      onBlur={async (e) => {
                                        if (e.target.value !== rl.quantityReturned) {
                                          try {
                                            await apiMutate(
                                              `/api/sales-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { quantityReturned: e.target.value },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : 'Failed to update return line');
                                          }
                                        }
                                      }}
                                    />
                                  ) : (
                                    rl.quantityReturned
                                  )}
                                </td>
                                <td>
                                  {isRetEditable ? (
                                    <input
                                      className="input"
                                      style={{ width: '100%' }}
                                      defaultValue={rl.reason || ''}
                                      key={`retrsn-${rl.returnLineId}-${rl.reason}`}
                                      onBlur={async (e) => {
                                        if (e.target.value !== (rl.reason || '')) {
                                          try {
                                            await apiMutate(
                                              `/api/sales-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { reason: e.target.value },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : 'Failed to update return line');
                                          }
                                        }
                                      }}
                                      placeholder="Reason"
                                    />
                                  ) : (
                                    <span style={{ fontSize: 12 }}>{rl.reason || '—'}</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {isRetEditable ? (
                                    <input
                                      className="input"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      style={{ width: '100%', textAlign: 'right' }}
                                      defaultValue={parseFloat(rl.returnFee || '0').toFixed(2)}
                                      key={`retfee-${rl.returnLineId}-${rl.returnFee}`}
                                      onBlur={async (e) => {
                                        const val = parseFloat(e.target.value);
                                        const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                                        if (formatted !== parseFloat(rl.returnFee || '0').toFixed(2)) {
                                          try {
                                            await apiMutate(
                                              `/api/sales-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { returnFee: formatted },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : 'Failed to update return line');
                                          }
                                        }
                                      }}
                                    />
                                  ) : (
                                    formatAmount(parseFloat(rl.returnFee || '0'), order.currencyCode || 'EUR')
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {(() => {
                                    const unitPrice = parseFloat(origLine?.pricePerUnit || '0');
                                    const qty = parseFloat(rl.quantityReturned || '0');
                                    return formatAmount(unitPrice * qty, order.currencyCode || 'EUR');
                                  })()}
                                </td>
                                {isRetEditable && (
                                  <td>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={async () => {
                                        if (!confirm('Remove this return line?')) return;
                                        try {
                                          await apiMutate(
                                            `/api/sales-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                            'DELETE',
                                          );
                                          await loadReturns();
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Failed to remove return line');
                                        }
                                      }}
                                      title="Remove return line"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                          {ret.lines.length === 0 && (
                            <tr>
                              <td
                                colSpan={isRetEditable ? 6 : 5}
                                style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px 0' }}
                              >
                                No return lines
                              </td>
                            </tr>
                          )}
                          {ret.lines.length > 0 && (() => {
                            const totalAmount = ret.lines.reduce((sum, rl) => {
                              const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                              const unitPrice = parseFloat(origLine?.pricePerUnit || '0');
                              return sum + unitPrice * parseFloat(rl.quantityReturned || '0');
                            }, 0);
                            const totalFees = ret.lines.reduce((sum, rl) => sum + parseFloat(rl.returnFee || '0'), 0);
                            const totalCredit = totalAmount - totalFees;
                            const cc = order.currencyCode || 'EUR';
                            return (
                              <>
                                <tr style={{ borderTop: '2px solid var(--border)' }}>
                                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                    Total Credit
                                  </td>
                                  <td></td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                    {formatAmount(totalAmount, cc)}
                                  </td>
                                  {isRetEditable && <td></td>}
                                </tr>
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                    Total Fees
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: totalFees > 0 ? '#f87171' : undefined }}>
                                    {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                  </td>
                                  <td></td>
                                  {isRetEditable && <td></td>}
                                </tr>
                                <tr>
                                  <td colSpan={isRetEditable ? 5 : 4} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                    Net Credit
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13, color: '#4ade80' }}>
                                    {formatAmount(totalCredit, cc)}
                                  </td>
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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

        {/* Global Toast Notification */}
        <div
          className="global-order-toast"
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: `translateX(-50%) ${toastData ? 'translateY(0)' : 'translateY(-150%)'}`,
            opacity: toastData ? 1 : 0,
            background: '#0ea5e9',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            borderRadius: '12px',
            padding: '16px 24px',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '4px',
            pointerEvents: toastData ? 'auto' as const : 'none' as const,
            transition: 'transform 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 300ms ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <strong style={{ fontSize: 14, color: '#ffffff' }}>
              Order State Updated
            </strong>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.4 }}>
            {toastData?.message}
          </p>
        </div>
    </Shell>
  );
}
