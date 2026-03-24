/* eslint-disable i18next/no-literal-string */
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderTotalsCard from '@/components/shared/OrderTotalsCard';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { computeLinePrice } from '@modbm/shared';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';

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

function GstLabel({ category }: { category: GstCategory }) {
  const t = useTranslations('common.gst');
  if (category.type === 'exempt') return t('exempt');
  if (category.type === 'zero_rated') return t('zeroRated');
  const pct = parseFloat(category.rate || '0');
  const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
  return t('pctGst', { pct: formattedPct });
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
  vendorId: string | null;
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

interface PurchaseInvoice {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: string;
  totalTax: string;
  createdOn: string;
  createdBy: string;
  erpnextJournalId: string | null;
}

import {
  RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  PURCHASE_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
  RETURN_LIFECYCLE,
  isBackTransition as sharedIsBackTransition,
  cap,
} from '@modbm/shared';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function isBackTransition(
  from: string, to: string,
  lifecycle: Record<string, number> = ORDER_LIFECYCLE,
): boolean {
  return sharedIsBackTransition(lifecycle, from, to);
}

function ReturnStateBadge({ state }: { state: ValidState }) {
  const t = useTranslations('common.states');
  return <span className={`badge badge-return-${state}`}>{t(state)}</span>;
}



export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source') || 'app';
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [latestAutoTransition, setLatestAutoTransition] = useState<{
    ruleName: string;
    from: string;
    to: string;
    reason: string;
  } | null>(null);

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
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoicing, setInvoicing] = useState(false);
  const [newReturnLines, setNewReturnLines] = useState<Array<{
    salesOrderLineId: string;
    quantityReturned: string;
    reason: string;
    returnFee: string;
    feeMode: 'absolute' | 'percentage';
    originalAmount: number;
  }>>([])

  const loadOrder = async (autoTransitions?: any[], showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch<OrderDetail>(
        `/api/purchase-orders/${encodeURIComponent(id)}?source=${source}`,
      );
      setOrder(data);
      setEditName(data.name || '');
      setEditPO(data.customerOrderNumber || '');
      setEditNotes(data.notes || '');
      setHeaderDirty(false);

      if (autoTransitions && autoTransitions.length > 0) {
        setLatestAutoTransition(autoTransitions[0]);
        setTimeout(() => setLatestAutoTransition(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tPurchase('orderNotFound'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const loadReturns = async () => {
    setReturnsLoading(true);
    try {
      const data = await apiFetch<OrderReturn[]>(`/api/purchase-orders/${encodeURIComponent(id)}/returns`);
      setReturns(data);
    } catch (err) {
      // Returns might not exist yet, that's fine
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await apiFetch<PurchaseInvoice[]>(`/api/purchase-orders/${encodeURIComponent(id)}/invoices`);
      setInvoices(data);
    } catch (err) {
      setInvoices([]);
    }
  };

  useEffect(() => {
    loadOrder();
    // Load GST categories
    apiFetch<GstCategory[]>('/api/gst-categories').then(setGstCategories).catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id, source]);

  // Load returns and invoices when order is received
  useEffect(() => {
    if (order?.stateCode === 'received' || order?.stateCode === 'legacy') {
      loadReturns();
      loadInvoices();
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

  // Header editable in all states except cancelled and legacy
  const isHeaderEditable = source === 'app' && order?.stateCode !== 'cancelled' && order?.stateCode !== 'legacy';
  // Lines editable only in draft
  const isLinesEditable = source === 'app' && order?.stateCode === 'draft';

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
      await apiMutate(`/api/purchase-orders/${id}`, 'PATCH', {
        name: editName || null,
        customerOrderNumber: editPO || null,
        notes: editNotes || null,
      });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateOrder'));
    } finally {
      setSaving(false);
    }
  };

  // State transitions
  const changeState = async (newState: string) => {
    try {
      await apiMutate(`/api/purchase-orders/${id}/state`, 'PATCH', { stateCode: newState });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeState'));
    }
  };

  // Copy order → create new draft with same lines
  const copyOrder = async () => {
    if (!order) return;
    setCopying(true);
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newOrder = await apiMutate<{ purchaseOrderId: string }>('/api/purchase-orders', 'POST', {
        orderNumber: `PO-${today}-${rand}`,
        name: order.name ? `Copy of ${order.name}` : undefined,
        vendorId: order.vendorId || undefined,
        currencyCode: order.currencyCode || 'EUR',
        notes: order.notes || undefined,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          productDescription: l.productDescription,
          quantity: l.quantity,
          pricePerUnit: l.pricePerUnit,
          unitOfMeasure: l.unitOfMeasure || 'EA',
        })),
      });
      router.push(`/purchase-orders/${newOrder.purchaseOrderId}?source=app`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToCopy'));
    } finally {
      setCopying(false);
    }
  };

  // Line editing
  const updateLine = async (lineId: string, field: string, value: string) => {
    setSaving(true);
    try {
      await apiMutate(`/api/purchase-orders/${id}/lines/${lineId}`, 'PATCH', { [field]: value });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateLine'));
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!confirm(tConfirm('removeLine'))) return;
    setSaving(true);
    setError('');
    try {
      await apiMutate(`/api/purchase-orders/${id}/lines/${lineId}`, 'DELETE');
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToRemoveLine'));
    } finally {
      setSaving(false);
    }
  };

  const addLineFromProduct = async (p: Product) => {
    setSaving(true);
    try {
      await apiMutate(`/api/purchase-orders/${id}/lines`, 'POST', {
        productId: p.productId,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.standardCost || p.tradePrice || p.listPrice || '0').toFixed(2),
        discountPercentage: '0',
        unitOfMeasure: 'EA',
      });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToAddLine'));
    } finally {
      setSaving(false);
    }
  };

  const addBlankLine = async () => {
    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    setSaving(true);
    try {
      await apiMutate(`/api/purchase-orders/${id}/lines`, 'POST', {
        productId: CUSTOM_LINE_ID,
        productDescription: '',
        quantity: '1',
        pricePerUnit: '0.00',
        discountPercentage: '0',
        unitOfMeasure: 'EA',
      });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToAddLine'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || tPurchase('orderNotFound')}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/purchase-orders')}>
            {tPurchase('backToOrders')}
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

  const sections = {
    details: { id: 'details-section', label: 'Details', show: true },
    notes: { id: 'notes-section', label: 'Notes', show: true },
    lines: { id: 'lines-section', label: 'Lines', show: true },
    invoices: { id: 'invoices-section', label: 'Invoices', show: (order.stateCode === 'received' || order.stateCode === 'legacy') && invoices.length > 0 },
    returns: { id: 'returns-section', label: 'Returns', show: (order.stateCode === 'received' || order.stateCode === 'legacy') && (returns.length > 0 || showCreateReturn) },
    activity: { id: 'activity-section', label: 'Activity', show: true },
  };
  const visibleSections = Object.values(sections).filter(s => s.show);

  return (
    <Shell>
      <DetailsLayout
        header={
          <EntityHeader
            title={order.orderNumber}
            subtitle={order.name || tPurchase('untitledOrder')}
            onBack={() => router.push('/purchase-orders')}
            isSaving={saving}
            badges={<StateBadge state={order.stateCode as ValidState} />}
            actions={
              <>
                <PageNav sections={visibleSections} />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={copyOrder}
                  disabled={copying}
                >
                  {copying ? tCommon('copying') : tPurchase('buttons.copyOrder')}
                </button>
                {(order.stateCode === 'received' || order.stateCode === 'legacy') && !showCreateReturn && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        if (!confirm('Enter supplier bill? This will publish AP ledger entries to ERPNext.')) return;
                        setSaving(true);
                        try {
                          await apiMutate(`/api/purchase-orders/${id}/invoice`, 'POST');
                          await loadOrder(undefined, false);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to generate supplier bill');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving || invoicing}
                    >
                      Enter Supplier Bill
                    </button>
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
                      {tPurchase('buttons.createReturn')}
                    </button>
                  </>
                )}
                {headerDirty && isHeaderEditable && (
                  <button className="btn btn-primary btn-sm" onClick={saveHeader} disabled={saving}>
                    {tPurchase('buttons.save')}
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
                        className={`btn btn-sm ${state === 'cancelled' ? 'btn-danger' : back ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => changeState(state)}
                      >
                        {state === 'cancelled' ? `✕ ${cap(state)}` : back ? `← ${cap(state)}` : `→ ${cap(state)}`}
                      </button>
                    );
                  })}
              </>
            }
          />
        }
      >
      <div className="flex flex-col gap-3">

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
          <button className="ml-3 text-xs underline" onClick={() => setError('')}>{tCommon('dismiss')}</button>
        </div>
      )}

          {/* Order info card */}
          <div id="details-section" className="card">
            <h3 className="section-heading">
              <span className="material-symbols-outlined">receipt_long</span>
              {tPurchase('orderDetails')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.supplier')}
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
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {order.vendorId || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.invoiceNumber')}
                  </label>
                  <input
                    className="input"
                    value={editPO}
                    onChange={(e) => setEditPO(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tPurchase('placeholders.invoiceNumber')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.orderName')}
                  </label>
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tPurchase('placeholders.orderName')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.created')}
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {new Date(order.createdOn).toLocaleString()} by {order.createdBy || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('notesCardHeading')}
                  </label>
                  <input
                    className="input w-full"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tCommon('notesCardPlaceholder')}
                  />
                </div>
              </div>
          </div>

        {/* Line items / Availability tabs */}
        <div id="lines-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-0">
              <button
                className="text-xs font-medium px-3 py-1.5 rounded-l-lg"
                style={{
                  color: activeTab === 'lines' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'lines' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'lines' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('lines')}
              >
                {tPurchase('lineItems')}
              </button>
              <button
                className="text-xs font-medium px-3 py-1.5 rounded-r-lg"
                style={{
                  color: activeTab === 'availability' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'availability' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'availability' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  borderLeft: activeTab === 'availability' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('availability')}
              >
                {tPurchase('availability')}
              </button>
            </div>
            {isLinesEditable && activeTab === 'lines' && (
              <>
                <ProductSearchInput
                  onSelect={addLineFromProduct}
                  placeholder="Add product… (search)"
                  style={{ width: 240 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={addBlankLine}
                  disabled={saving}
                >
                  + {tPurchase('buttons.customLine')}
                </button>
              </>
            )}
          </div>

          {activeTab === 'lines' ? (
            <table className="table-lines">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                  <th>{tPurchase('columns.product')}</th>
                  <th>{tPurchase('columns.description')}</th>
                  <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.qty')}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.amount')}</th>
                  {isLinesEditable && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.salesOrderLineId}>
                    <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                      {line.productNumber || line.productId?.substring(0, 8) || '—'}
                    </td>
                    <td>
                      {(!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isLinesEditable ? (
                        <input
                          className="input"
                          style={{ width: '100%', fontSize: 13 }}
                          defaultValue={line.productDescription || ''}
                          key={`desc-${line.salesOrderLineId}-${line.productDescription}`}
                          onBlur={(e) => {
                            if (e.target.value !== (line.productDescription || '')) {
                              updateLine(line.salesOrderLineId, 'productDescription', e.target.value);
                            }
                          }}
                          placeholder="Custom description..."
                        />
                      ) : (
                        line.productDescription || '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        style={{ width: '100%', textAlign: 'right' }}
                        defaultValue={line.quantity}
                        key={`qty-${line.salesOrderLineId}-${line.quantity}`}
                        disabled={!isLinesEditable}
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
                        disabled={!isLinesEditable}
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
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatAmount(parseFloat(line.amount || '0'), order.currencyCode || 'EUR')}
                    </td>
                    {isLinesEditable && (
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
                      colSpan={isLinesEditable ? 6 : 5}
                      style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                    >
                      {tPurchase('noLineItems')}
                    </td>
                  </tr>
                )}
                {order.lines.length > 0 && (() => {
                  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                  return (
                    <>
                      <tr style={{ borderTop: '2px solid var(--border)' }}>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('subtotal')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {tCommon('total')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          ) : (
            /* Availability tab */
            inventoryLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tPurchase('loadingInventory')}</p>
            ) : (
              <table className="table-lines">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                    <th>{tPurchase('columns.product')}</th>
                    <th>{tPurchase('columns.description')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                    <th style={{ width: 100, textAlign: 'right' }}>{tPurchase('columns.location')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.onHand')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.committed')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.reserved')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.available')}</th>
                    <th style={{ width: 70, textAlign: 'center' }}>{tPurchase('columns.status')}</th>
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
                            {tPurchase('noInventoryData')}
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
                        {tPurchase('noLineItemsShort')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Invoices section */}
        {(order.stateCode === 'received' || order.stateCode === 'legacy') && invoices.length > 0 && (
            <div id="invoices-section" className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Supplier Bills
                    </h3>
                </div>
                <div className="space-y-3">
                    {invoices.map(inv => (
                        <div key={inv.invoiceId} style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="flex flex-col">
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{inv.invoiceNumber}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {new Date(inv.createdOn).toLocaleString()} {inv.createdBy && `by ${inv.createdBy}`}
                                </span>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="text-right">
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{formatAmount(parseFloat(inv.totalAmount || '0'), order.currencyCode || 'EUR')}</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Tax: {formatAmount(parseFloat(inv.totalTax || '0'), order.currencyCode || 'EUR')}</div>
                                </div>
                                {inv.erpnextJournalId && (
                                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }} title="ERPNext General Ledger Entry">
                                        GL: {inv.erpnextJournalId}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Returns section — only shown when returns exist or creating one */}
        {(order.stateCode === 'received' || order.stateCode === 'legacy') && (returns.length > 0 || showCreateReturn) && (
          <div id="returns-section" className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {tPurchase('returns' as any)}
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
                    {tPurchase('newReturn')}
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
                      {tCommon('cancel')}
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
                          await apiMutate(`/api/purchase-orders/${id}/returns`, 'POST', {
                            notes: newReturnNotes || undefined,
                            lines,
                          });
                          setShowCreateReturn(false);
                          setNewReturnLines([]);
                          setNewReturnNotes('');
                          await loadReturns();
                          await loadOrder(undefined, false);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : tCommon('errors.failedToCreateReturn'));
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      {tCommon('save')}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('notesCardHeading')}
                  </label>
                  <input
                    className="input"
                    value={newReturnNotes}
                    onChange={(e) => setNewReturnNotes(e.target.value)}
                    placeholder={tPurchase('placeholders.notes')}
                  />
                </div>

                <table className="table-lines">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                      <th>{tPurchase('columns.product')}</th>
                      <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                      <th style={{ width: 100, textAlign: 'right' }}>{tPurchase('columns.qtyReturned')}</th>
                      <th style={{ width: 180 }}>{tPurchase('columns.reason')}</th>
                      <th style={{ width: 140, textAlign: 'right' }}>{tPurchase('columns.fee')}</th>
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
                              {line.productId?.substring(0, 8) || '—'}
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
                              placeholder={tPurchase('placeholders.reason')}
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
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
            ) : returns.length === 0 && !showCreateReturn ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tPurchase('noReturns')}</p>
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
                          <ReturnStateBadge state={ret.stateCode as ValidState} />
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
                                  await apiMutate(`/api/purchase-orders/${id}/returns/${ret.returnId}/state`, 'PATCH', { stateCode: s });
                                  await loadReturns();
                                  await loadOrder(undefined, false);
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeReturnState'));
                                }
                              }}
                            >
                              → <StateName state={s as ValidState} />
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
                            <th>{tPurchase('columns.product')}</th>
                            <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.qtyReturned')}</th>
                            <th style={{ width: 180 }}>{tPurchase('columns.reason')}</th>
                            <th style={{ width: 100, textAlign: 'right' }}>{tPurchase('columns.fee')}</th>
                            <th style={{ width: 100, textAlign: 'right' }}>{tPurchase('columns.amount')}</th>
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
                                    {origLine?.productId?.substring(0, 8) || '—'}
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
                                              `/api/purchase-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { quantityReturned: e.target.value },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
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
                                              `/api/purchase-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { reason: e.target.value },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                          }
                                        }
                                      }}
                                      placeholder={tPurchase('placeholders.reason')}
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
                                              `/api/purchase-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                              'PATCH',
                                              { returnFee: formatted },
                                            );
                                            await loadReturns();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
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
                                    return formatAmount(computeLinePrice({ quantity: qty, pricePerUnit: unitPrice }).amount, order.currencyCode || 'EUR');
                                  })()}
                                </td>
                                {isRetEditable && (
                                  <td>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={async () => {
                                        if (!confirm(tConfirm('removeReturnLine'))) return;
                                        try {
                                          await apiMutate(
                                            `/api/purchase-orders/${id}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                            'DELETE',
                                          );
                                          await loadReturns();
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : tCommon('errors.failedToRemoveReturnLine'));
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
                                {tPurchase('noReturnLines')}
                              </td>
                            </tr>
                          )}
                          {ret.lines.length > 0 && (() => {
                            const totalAmount = ret.lines.reduce((sum, rl) => {
                              const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                              const unitPrice = parseFloat(origLine?.pricePerUnit || '0');
                              const qty = parseFloat(rl.quantityReturned || '0');
                              return sum + computeLinePrice({ quantity: qty, pricePerUnit: unitPrice }).amount;
                            }, 0);
                            const totalFees = ret.lines.reduce((sum, rl) => sum + parseFloat(rl.returnFee || '0'), 0);
                            const totalCredit = totalAmount - totalFees;
                            const cc = order.currencyCode || 'EUR';
                            return (
                              <>
                                <tr style={{ borderTop: '2px solid var(--border)' }}>
                                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                    {tPurchase('returns.totalCredit')}
                                  </td>
                                  <td></td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                    {formatAmount(totalAmount, cc)}
                                  </td>
                                  {isRetEditable && <td></td>}
                                </tr>
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                    {tPurchase('returns.totalFees')}
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: totalFees > 0 ? '#f87171' : undefined }}>
                                    {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                  </td>
                                  <td></td>
                                  {isRetEditable && <td></td>}
                                </tr>
                                <tr>
                                  <td colSpan={isRetEditable ? 5 : 4} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                    {tPurchase('returns.netCredit')}
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

        {/* Audit timeline */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={order.events || []} />
        </div>
      </div>
      </DetailsLayout>

      {/* Global Toast Notification for Auto-Transitions */}
      <div
        className={`fixed bottom-6 right-6 rounded-lg p-4 max-w-[400px] z-[60] flex flex-col gap-1 pointer-events-none shadow-lg border border-[var(--border)] transition-all duration-300 ease-out ${latestAutoTransition ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        style={{ background: 'var(--bg-card)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {tToast('orderStateUpdated')}
          </strong>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {latestAutoTransition && (
            tToast('orderMovedToReason', {
              state: tCommon(`states.${latestAutoTransition.to}` as any),
              reason: latestAutoTransition.reason.toLowerCase()
            })
          )}
        </p>
      </div>
    </Shell>
  );
}
