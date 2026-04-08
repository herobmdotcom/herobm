'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import OrderTotalsCard from '@/components/shared/OrderTotalsCard';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { computeLinePrice, calculateUomPriceAdjustment } from '@modbm/shared';
import type { ProductUom } from '@modbm/shared';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';

import type { GstCategory, OrderLine, OrderDetail, InventoryLevel, OrderReturn, ReturnLine, OrderEvent } from './types';
import type { PurchaseInvoice } from '@/lib/purchase-order-utils';
import { getGstLabel } from './types';
import InvoicesSection from './InvoicesSection';
import ReceivingSection from './ReceivingSection';

function GstLabel({ category }: { category: GstCategory }) {
  if (!category) return null;
  return <>{getGstLabel(category)}</>;
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
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentTitle(order ? (order.name ? `${order.orderNumber} - ${order.name}` : order.orderNumber) : null);
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
    purchaseOrderLineId: string;
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
        `/api/purchase-orders/${encodeURIComponent(id)}`,
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
      const data: any = await apiFetch(`/api/purchase-orders/${encodeURIComponent(id)}/returns`);
      setReturns(data?.data || data || []);
    } catch (err) {
      // Returns might not exist yet, that's fine
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data: any = await apiFetch(`/api/purchase-orders/${encodeURIComponent(id)}/invoices`);
      setInvoices(data?.data || data || []);
    } catch (err) {
      setInvoices([]);
    }
  };

  useEffect(() => {
    loadOrder();
    // Load GST categories
    apiFetch<GstCategory[]>('/api/gst-categories').then(setGstCategories).catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id]);

  // Load returns and invoices when order is received, partially_received, billed or invoiced
  useEffect(() => {
    if (['received', 'partially_received', 'billed', 'invoiced', 'legacy'].includes(order?.stateCode || '')) {
      loadInvoices();
    }
    if (['billed', 'invoiced', 'legacy'].includes(order?.stateCode || '')) {
      loadReturns();
    }
  }, [order?.stateCode]);

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

  const isHeaderEditable = order?.stateCode !== 'cancelled' && order?.stateCode !== 'legacy';
  // Lines editable only in draft
  const isLinesEditable = order?.stateCode === 'draft';

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
          discountPercentage: l.discountPercentage || '0',
          gstCategoryId: l.gstCategoryId || null,
          unitOfMeasure: l.unitOfMeasure || 'EA',
        })),
      });
      router.push(`/purchase-orders/${newOrder.purchaseOrderId}`);
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

  const updateLineFields = async (lineId: string, payload: Record<string, any>) => {
    setSaving(true);
    try {
      await apiMutate(`/api/purchase-orders/${id}/lines/${lineId}`, 'PATCH', payload);
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
      <>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || tPurchase('orderNotFound')}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/purchase-orders')}>
            {tPurchase('backToOrders')}
          </button>
        </div>
      </>
    );
  }

  const allowedTransitions = STATE_TRANSITIONS[order.stateCode] || [];
  const subtotal = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.amount || '0'), 0,
  );
  const totalTax = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.tax || '0'), 0,
  );

  const sections = {
    details: { id: 'details-section', label: 'Details', show: true },
    receiving: { id: 'receivings-section', label: 'Receiving', show: ['partially_received', 'received', 'billed', 'invoiced', 'legacy'].includes(order.stateCode) },
    invoices: { id: 'Invoices-section', label: 'Invoices', show: true },
    activity: { id: 'activity-section', label: 'Activity', show: true },
  };
  const visibleSections = Object.values(sections).filter(s => s.show);

  return (
    <>
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">receipt_long</span>
                {tPurchase('orderDetails')}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyOrder}
                disabled={copying}
              >
                {copying ? tCommon('copying') : tPurchase('buttons.copyOrder')}
              </button>
            </div>
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
                    {order.vendorName || order.vendorId || '—'}
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
                    {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy || '—'}
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
                  <th style={{ width: 80, textAlign: 'right' }}>{tPurchase('columns.uom')}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
                  <th style={{ width: 80, textAlign: 'right' }}>{tPurchase('columns.discountPct' as any)}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.gst' as any)}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.amount')}</th>
                  {isLinesEditable && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.purchaseOrderLineId}>
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
                          key={`desc-${line.purchaseOrderLineId}-${line.productDescription}`}
                          onBlur={(e) => {
                            if (e.target.value !== (line.productDescription || '')) {
                              updateLine(line.purchaseOrderLineId, 'productDescription', e.target.value);
                            }
                          }}
                          placeholder="Custom description..."
                        />
                      ) : (
                        line.productDescription || '—'
                      )}
                    </td>
                    {isLinesEditable ? (
                      <>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="1"
                            style={{ width: '100%', textAlign: 'right' }}
                            defaultValue={line.quantity}
                            key={`qty-${line.purchaseOrderLineId}-${line.quantity}`}
                            onBlur={(e) => {
                              if (e.target.value !== line.quantity) {
                                updateLine(line.purchaseOrderLineId, 'quantity', e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {(() => {
                            const uoms: ProductUom[] = line.productUoms || [];
                            const defaultUom = line.baseUom || 'EA';
                            const selectOptions = uoms.length > 0 ? uoms : [{ uomCode: defaultUom, ratio: 1 }];
                            return (
                              <select
                                className="input"
                                style={{ width: '100%', fontSize: 13, textAlign: 'right' }}
                                value={line.unitOfMeasure || defaultUom}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  const oldVal = line.unitOfMeasure || defaultUom;
                                  if (newVal !== oldVal) {
                                    const oldO = selectOptions.find(o => o.uomCode === oldVal);
                                    const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
    
                                    const newO = selectOptions.find(o => o.uomCode === newVal);
                                    const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);
    
                                    const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                                    updateLineFields(line.purchaseOrderLineId, {
                                      unitOfMeasure: newVal,
                                      pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2)
                                    });
                                  }
                                }}
                              >
                                {selectOptions.map(o => (
                                  <option key={o.uomCode} value={o.uomCode}>{o.uomCode}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: '100%', textAlign: 'right' }}
                            defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                            key={`price-${line.purchaseOrderLineId}-${line.pricePerUnit}`}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                              e.target.value = formatted;
                              if (formatted !== parseFloat(line.pricePerUnit || '0').toFixed(2)) {
                                updateLine(line.purchaseOrderLineId, 'pricePerUnit', formatted);
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
                            defaultValue={line.discountPercentage}
                            key={`disc-${line.purchaseOrderLineId}-${line.discountPercentage}`}
                            onBlur={(e) => {
                              if (e.target.value !== line.discountPercentage) {
                                updateLine(line.purchaseOrderLineId, 'discountPercentage', e.target.value);
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
                          {line.unitOfMeasure || line.baseUom || 'EA'}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {parseFloat(line.discountPercentage || '0').toFixed(1)}%
                        </td>
                      </>
                    )}
                    {isLinesEditable ? (
                      <td style={{ textAlign: 'right' }}>
                        <select
                          className="input"
                          style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                          value={line.gstCategoryId || ''}
                          onChange={(e) => updateLine(line.purchaseOrderLineId, 'gstCategoryId', e.target.value)}
                        >
                          <option value="">{tCommon('defaultOption')}</option>
                          {gstCategories.map((c) => (
                            <option key={c.gstCategoryId} value={c.gstCategoryId}>
                              <GstLabel category={c} />
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : (
                      <td style={{ textAlign: 'right', fontSize: 12 }}>
                        {(() => {
                          const c = gstCategories.find((c) => c.gstCategoryId === line.gstCategoryId);
                          if (c) return <GstLabel category={c} />;
                          // Legacy derivation
                          const amt = parseFloat(line.amount || '0');
                          const tax = parseFloat(line.tax || '0');
                          if (amt > 0 && tax > 0) {
                            const pct = (tax / amt) * 100;
                            return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                          }
                          if (amt > 0 && tax === 0) return tCommon('gst.exempt');
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
                    {isLinesEditable && (
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => removeLine(line.purchaseOrderLineId)}
                          title="Remove line"
                        >
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {order.lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={isLinesEditable ? 9 : 8}
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
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('subtotal')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
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
                        <tr key={line.purchaseOrderLineId}>
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
                        <tr key={`${line.purchaseOrderLineId}-${inv.inventoryLevelId}`}>
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

        <ReceivingSection
          orderId={id}
          orderLines={order.lines}
          events={order.events}
          currencyCode={order.currencyCode}
        />

        <InvoicesSection
          orderId={id}
          order={order}
          Invoices={invoices}
          gstCategories={gstCategories}
          setError={setError}
          loadInvoices={loadInvoices}
          loadOrder={loadOrder as any}
        />

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
    </>
  );
}
