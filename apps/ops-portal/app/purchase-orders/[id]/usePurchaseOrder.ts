'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import * as api from '@modbm/sdk';
import {
  PURCHASE_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  PURCHASE_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
  PURCHASE_ORDER_STATE,
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
  const [editExpectedDate, setEditExpectedDate] = useState('');
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
  const isHeaderEditable = order?.stateCode === PURCHASE_ORDER_STATE.DRAFT || order?.stateCode === PURCHASE_ORDER_STATE.ORDERED || order?.stateCode === PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED;
  const isLinesEditable = order?.stateCode === PURCHASE_ORDER_STATE.DRAFT;

  const allowedTransitions = useMemo(() => {
    if (!order) return [];
    return STATE_TRANSITIONS[order.stateCode] || [];
  }, [order?.stateCode]);

  /** Visible transition buttons (filtered based on business rules) */
  const visibleTransitions = useMemo(() => {
    if (!order) return [];
    const anyReceived = order.lines.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => parseFloat(l.quantityReceived || '0') > 0,
    );
    return [...allowedTransitions]
      .filter(state => ![PURCHASE_ORDER_STATE.RECEIVED, PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED, PURCHASE_ORDER_STATE.INVOICED].some(s => s === state))
      .filter(state => {
        if (state === PURCHASE_ORDER_STATE.CANCELLED && anyReceived) return false;
        if (state === PURCHASE_ORDER_STATE.CLOSED_SHORT && !anyReceived) return false;
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
        const label = state === PURCHASE_ORDER_STATE.CANCELLED ? tCommon('cancel') : state === PURCHASE_ORDER_STATE.CLOSED_SHORT ? 'Close Short' : cap(state);
        const isDanger = state === PURCHASE_ORDER_STATE.CANCELLED || state === PURCHASE_ORDER_STATE.CLOSED_SHORT;
        const icon = state === PURCHASE_ORDER_STATE.CANCELLED ? 'close' : isDanger ? '✕ ' : back ? '← ' : '→ ';
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadOrder = async (autoTransitions?: any[], showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.purchaseOrdersControllerFindOne(id);
      const data = res?.data;
      setOrder(data as unknown as OrderDetail);
      setEditName(data.name || '');
      setEditReferenceNumber(data.referenceNumber || '');
      setEditExpectedDate(data.expectedDate ? new Date(data.expectedDate).toISOString().split('T')[0] : '');
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
      const { data } = await api.purchaseReturnsControllerFindReturns(id);
      setReturns((Array.isArray(data) ? data : (data as unknown as { data: OrderReturn[] })?.data || []) as OrderReturn[]);
    } catch {
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const { data } = await api.purchaseInvoiceControllerGetPurchaseBills(id);
      setInvoices((data || []) as unknown as PurchaseInvoice[]);
    } catch {
      setInvoices([]);
    }
  };

  const loadAllocations = async () => {
    setAllocationsLoading(true);
    try {
      const { data } = await api.allocationsControllerGetAllocationsByPo(id);
      setAllocations((Array.isArray(data) ? data : (data as unknown as { data: Allocation[] })?.data || []) as Allocation[]);
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
    api.taxCategoriesControllerFindAll()
      .then(res => setTaxCategories((res.data || []).map((t: import('@modbm/sdk').TaxCategoryResponseDto) => ({ ...t, taxCategoryId: (t as unknown as { id?: string }).id || t.taxCategoryId } as unknown as TaxCategory))))
      .catch((err) => reportError(err, 'OrderDetailPage'));
  }, [id]);

  // Load returns and invoices based on order state
  useEffect(() => {
    if ([
      PURCHASE_ORDER_STATE.ORDERED, 
      PURCHASE_ORDER_STATE.RECEIVED, 
      PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED, 
      PURCHASE_ORDER_STATE.INVOICED, 
      PURCHASE_ORDER_STATE.LEGACY, 
      PURCHASE_ORDER_STATE.ARCHIVED
    ].some(s => s === order?.stateCode)) {
      loadInvoices();
      loadAllocations();
    }
    if ([PURCHASE_ORDER_STATE.INVOICED, PURCHASE_ORDER_STATE.LEGACY].some(s => s === order?.stateCode)) {
      loadReturns();
    }
  }, [order?.stateCode]);

  // Load inventory when availability tab is selected
  useEffect(() => {
    if (activeTab !== 'availability' || !order || order.lines.length === 0) return;
    const productIds = [...new Set(order.lines.map((l) => l.productId).filter(Boolean))];
    if (productIds.length === 0) return;
    setInventoryLoading(true);
    api.inventoryControllerFindByProductIds({ productIds: productIds.join(','), locationId: '' })
      .then((res) => setInventoryData(res.data || []))
      .catch((err) => reportError(err, 'OrderDetailPage'))
      .finally(() => setInventoryLoading(false));
  }, [activeTab, order]);

  // Track header changes
  useEffect(() => {
    if (!order) return;
    const changed =
      editName !== (order.name || '') ||
      editReferenceNumber !== (order.referenceNumber || '') ||
      editExpectedDate !== (order.expectedDate ? new Date(order.expectedDate).toISOString().split('T')[0] : '') ||
      editNotes !== (order.notes || '') ||
      editLocationId !== (order.deliveryLocationId || null);
    setHeaderDirty(changed);
  }, [editName, editReferenceNumber, editExpectedDate, editNotes, editLocationId, order]);

  /* ── Mutations ──────────────────────────────────────────────── */

  const saveHeader = async () => {
    if (!headerDirty) return;
    setSaving(true);
    try {
      await api.purchaseOrdersControllerUpdate(id, {
        name: editName || undefined,
        referenceNumber: editReferenceNumber || undefined,
        expectedDate: editExpectedDate ? new Date(editExpectedDate).toISOString() : undefined,
        notes: editNotes || undefined,
        deliveryLocationId: editLocationId || undefined,
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
      await api.purchaseOrdersControllerChangeState(id, { stateCode: newState });
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
      const { data: newOrder } = await api.purchaseOrdersControllerCreate({
        purchaseOrderId: crypto.randomUUID(),
        orderNumber: `PO-${today}-${rand}`,
        name: order.name ? `Copy of ${order.name}` : undefined,
        vendorId: order.vendorId || '',
        deliveryLocationId: order.deliveryLocationId || '',
        currencyCode: order.currencyCode ?? 'EUR',
        notes: order.notes || undefined,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          productDescription: l.productDescription,
          quantity: String(l.quantity),
          pricePerUnit: String(l.pricePerUnit),
          discountPercentage: String(l.discountPercentage || '0'),
          taxCategoryId: l.taxCategoryId || undefined,
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
      await api.purchaseOrdersControllerUpdateLine(id, lineId, { [field]: value });
      await loadOrder(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateLine'));
    } finally {
      setSaving(false);
    }
  };

  const updateLineFields = async (lineId: string, payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.purchaseOrdersControllerUpdateLine(id, lineId, payload);
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
      await api.purchaseOrdersControllerRemoveLine(id, lineId);
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
      await api.purchaseOrdersControllerAddLine(id, {
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
      await api.purchaseOrdersControllerAddLine(id, {
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
    editExpectedDate, setEditExpectedDate,
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
