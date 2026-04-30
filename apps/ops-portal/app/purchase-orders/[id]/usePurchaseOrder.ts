'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  PURCHASE_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  PURCHASE_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
  isBackTransition as sharedIsBackTransition,
  cap,
  calculateUomPriceAdjustment,
} from '@modbm/shared';
import type { ProductUom } from '@modbm/shared';

import type {
  TaxCategory, OrderLine, OrderDetail,
  InventoryLevel, OrderReturn, OrderEvent, Allocation
} from './types';
import type { PurchaseInvoice } from '@/lib/purchase-order-utils';
import type { Product } from '@/components/shared/ProductSearchInput';

/* ── Hook ────────────────────────────────────────────────────────── */

export function usePurchaseOrder(id: string) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm');

  /* ── Core state ──────────────────────────────────────────────── */
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');
  const setError = (msg: string) => {
    _setError(msg);
    if (msg) toast.error(msg);
  };
  const clearError = () => _setError('');
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [latestAutoTransition, setLatestAutoTransition] = useState<{
    ruleName: string;
    from: string;
    to: string;
    reason: string;
  } | null>(null);

  /* ── Editable header fields ──────────────────────────────────── */
  const [editName, setEditName] = useState('');
  const [editReferenceNumber, setEditReferenceNumber] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [headerDirty, setHeaderDirty] = useState(false);

  /* ── GST categories ──────────────────────────────────────────── */
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);

  /* ── Tab state for line items / availability ────────────────── */
  const [activeTab, setActiveTab] = useState<'lines' | 'availability' | 'status'>('lines');
  const [inventoryData, setInventoryData] = useState<InventoryLevel[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  /* ── Returns state ──────────────────────────────────────────── */
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [showCreateReturn, setShowCreateReturn] = useState(false);
  const [newReturnNotes, setNewReturnNotes] = useState('');
  const [newReturnLines, setNewReturnLines] = useState<Array<{
    purchaseOrderLineId: string;
    quantityReturned: string;
    reason: string;
    returnFee: string;
    feeMode: 'absolute' | 'percentage';
    originalAmount: number;
  }>>([]);

  /* ── Invoices state ─────────────────────────────────────────── */
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoicing, setInvoicing] = useState(false);

  /* ── Allocations state ──────────────────────────────────────── */
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);

  /* ── Derived flags ──────────────────────────────────────────── */
  const isHeaderEditable = order?.stateCode !== 'cancelled' && order?.stateCode !== 'legacy';
  const isLinesEditable = order?.stateCode === 'draft';

  const allowedTransitions = useMemo(() => {
    if (!order) return [];
    return STATE_TRANSITIONS[order.stateCode] || [];
  }, [order?.stateCode]);

  /** Visible transition buttons (filtered based on business rules) */
  const visibleTransitions = useMemo(() => {
    if (!order) return [];
    const anyReceived = order.lines.some(
      (l: any) => parseFloat(l.quantityReceived || '0') > 0,
    );
    return [...allowedTransitions]
      .filter(state => !['received', 'partially_received'].includes(state))
      .filter(state => {
        if (state === 'cancelled' && anyReceived) return false;
        if (state === 'closed_short' && !anyReceived) return false;
        return true;
      })
      .sort((a, b) => {
        const aBack = isBackTransition(order.stateCode, a);
        const bBack = isBackTransition(order.stateCode, b);
        if (aBack !== bBack) return aBack ? -1 : 1;
        return 0;
      })
      .map(state => {
        const back = isBackTransition(order.stateCode, state);
        const label = state === 'closed_short' ? 'Close Short' : cap(state);
        const isDanger = state === 'cancelled' || state === 'closed_short';
        const icon = isDanger ? '✕ ' : back ? '← ' : '→ ';
        return { state, label, icon, isDanger, isBack: back };
      });
  }, [order, allowedTransitions]);

  const subtotal = useMemo(() => {
    if (!order) return 0;
    return order.lines.reduce((sum, l) => sum + parseFloat(l.amount || '0'), 0);
  }, [order?.lines]);

  const totalTax = useMemo(() => {
    if (!order) return 0;
    return order.lines.reduce((sum, l) => sum + parseFloat(l.tax || '0'), 0);
  }, [order?.lines]);

  /* ── Data loaders ───────────────────────────────────────────── */

  const loadOrder = async (autoTransitions?: any[], showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch<OrderDetail>(
        `/api/purchase-orders/${encodeURIComponent(id)}`,
      );
      setOrder(data);
      setEditName(data.name || '');
      setEditReferenceNumber(data.referenceNumber || '');
      setEditNotes(data.notes || '');
      setEditLocationId(data.deliveryLocationId || null);
      setHeaderDirty(false);

      if (autoTransitions && autoTransitions.length > 0) {
        setLatestAutoTransition(autoTransitions[0]);
        setTimeout(() => setLatestAutoTransition(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToLoadOrder'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const loadReturns = async () => {
    setReturnsLoading(true);
    try {
      const data: any = await apiFetch(`/api/purchase-orders/${encodeURIComponent(id)}/returns`);
      setReturns(data?.data || data || []);
    } catch {
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data: any = await apiFetch(`/api/purchase-orders/${encodeURIComponent(id)}/invoices`);
      setInvoices(data?.data || data || []);
    } catch {
      setInvoices([]);
    }
  };

  const loadAllocations = async () => {
    setAllocationsLoading(true);
    try {
      const { data } = await apiFetch<{ data: Allocation[] }>(`/api/allocations/by-po/${encodeURIComponent(id)}`);
      setAllocations(data || []);
    } catch {
      setAllocations([]);
    } finally {
      setAllocationsLoading(false);
    }
  };

  /* ── Effects ────────────────────────────────────────────────── */

  // Initial load
  useEffect(() => {
    loadOrder();
    apiFetch<TaxCategory[]>('/api/tax-categories')
      .then(setTaxCategories)
      .catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id]);

  // Load returns and invoices based on order state
  useEffect(() => {
    if (['ordered', 'received', 'partially_received', 'billed', 'invoiced', 'legacy', 'archived'].includes(order?.stateCode || '')) {
      loadInvoices();
      loadAllocations();
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

  // Track header changes
  useEffect(() => {
    if (!order) return;
    const changed =
      editName !== (order.name || '') ||
      editReferenceNumber !== (order.referenceNumber || '') ||
      editNotes !== (order.notes || '') ||
      editLocationId !== (order.deliveryLocationId || null);
    setHeaderDirty(changed);
  }, [editName, editReferenceNumber, editNotes, editLocationId, order]);

  /* ── Mutations ──────────────────────────────────────────────── */

  const saveHeader = async () => {
    if (!headerDirty) return;
    setSaving(true);
    try {
      await apiMutate(`/api/purchase-orders/${id}`, 'PATCH', {
        name: editName || null,
        referenceNumber: editReferenceNumber || null,
        notes: editNotes || null,
        deliveryLocationId: editLocationId || null,
      });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateOrder'));
    } finally {
      setSaving(false);
    }
  };

  const changeState = async (newState: string) => {
    try {
      await apiMutate(`/api/purchase-orders/${id}/state`, 'PATCH', { stateCode: newState });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeState'));
    }
  };

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
        deliveryLocationId: order.deliveryLocationId || undefined,
        currencyCode: order.currencyCode || 'EUR',
        notes: order.notes || undefined,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          productDescription: l.productDescription,
          quantity: l.quantity,
          pricePerUnit: l.pricePerUnit,
          discountPercentage: l.discountPercentage || '0',
          taxCategoryId: l.taxCategoryId || null,
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
    _setError('');
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

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    // Core state
    order,
    loading,
    error,
    saving,
    copying,
    latestAutoTransition,

    // Derived flags
    isHeaderEditable,
    isLinesEditable,
    visibleTransitions,
    subtotal,
    totalTax,

    // Header editing
    editName, setEditName,
    editReferenceNumber, setEditReferenceNumber,
    editNotes, setEditNotes,
    editLocationId, setEditLocationId,
    headerDirty,

    // Tax
    taxCategories,

    // Tab state
    activeTab, setActiveTab,
    inventoryData,
    inventoryLoading,

    // Returns
    returns,
    returnsLoading,
    showCreateReturn, setShowCreateReturn,
    newReturnNotes, setNewReturnNotes,
    newReturnLines, setNewReturnLines,

    // Invoices
    invoices,
    invoicing, setInvoicing,

    // Allocations
    allocations,
    allocationsLoading,

    // Actions
    setError,
    clearError,
    saveHeader,
    changeState,
    copyOrder,
    updateLine,
    updateLineFields,
    removeLine,
    addLineFromProduct,
    addBlankLine,
    loadOrder,
    loadInvoices,
    loadReturns,
    loadAllocations,
  };
}

/* ── Helpers re-exported for the page component ──────────────── */

function isBackTransition(
  from: string, to: string,
  lifecycle: Record<string, number> = ORDER_LIFECYCLE,
): boolean {
  return sharedIsBackTransition(lifecycle, from, to);
}
