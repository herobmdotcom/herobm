'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate, reportError, ApiError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS } from '@modbm/shared';

import type {
    OrderDetail, TaxCategory, InventoryLevel,
    OrderReturn, SalesInvoice,
} from './types';
import type { Product } from '@/components/shared/ProductSearchInput';

/* ── New-invoice-line shape ──────────────────────────────────────── */
export interface NewInvoiceLine {
    salesOrderLineId: string;
    quantityToInvoice: string;
    maxQuantity: number;
}

/* ── New-return-line shape ───────────────────────────────────────── */
export interface NewReturnLine {
    salesOrderLineId: string;
    quantityReturned: string;
    reason: string;
    returnFee: string;
    feeMode: 'absolute' | 'percentage';
    originalAmount: number;
}

/* ── Hook ────────────────────────────────────────────────────────── */

export function useOrder(id: string) {
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
    const [saving, setSaving] = useState(false);
    const [copying, setCopying] = useState(false);

    const [locations, setLocations] = useState<{ locationId: string; name: string }[]>([]);

    useEffect(() => {
        apiFetch<{ data: { locationId: string; name: string }[] }>('/api/inventory/locations')
            .then(res => setLocations(res.data))
            .catch(err => reportError(err, 'Locations_Fetch'));
    }, []);

    /* ── Editable header fields ──────────────────────────────────── */
    const [editName, setEditName] = useState('');
    const [editPO, setEditPO] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editFulfillmentLocationId, setEditFulfillmentLocationId] = useState('');
    const [headerDirty, setHeaderDirty] = useState(false);

    /* ── GST categories ──────────────────────────────────────────── */
    const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);

    /* ── Tab state for line items / availability / backorders ────── */
    const [activeTab, setActiveTab] = useState<'lines' | 'availability' | 'backorders'>('lines');
    const [inventoryData, setInventoryData] = useState<InventoryLevel[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);

    /* ── Returns state ───────────────────────────────────────────── */
    const [returns, setReturns] = useState<OrderReturn[]>([]);
    const [returnsLoading, setReturnsLoading] = useState(false);
    const [showCreateReturn, setShowCreateReturn] = useState(false);
    const [newReturnNotes, setNewReturnNotes] = useState('');
    const [newReturnLines, setNewReturnLines] = useState<NewReturnLine[]>([]);

    /* ── Invoices state ──────────────────────────────────────────── */
    const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
    const [invoicing, setInvoicing] = useState(false);
    const [showCreateInvoice, setShowCreateInvoice] = useState(false);
    const [pickingSummary, setPickingSummary] = useState<any>(null);
    const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
    const [newInvoiceLines, setNewInvoiceLines] = useState<NewInvoiceLine[]>([]);

    /* ── Data loaders ────────────────────────────────────────────── */

    const loadOrder = async (autoTransitions?: any[], showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const [data, pData] = await Promise.all([
                apiFetch<any>(
                    `/api/sales-orders/${encodeURIComponent(id)}`,
                ),
                apiFetch<any>(
                    `/api/sales-orders/${encodeURIComponent(id)}/picking`,
                ).catch(() => null),
            ]);
            setOrder(data?.data || data);
            setPickingSummary(pData?.data || pData);
            setEditName(data?.data?.name || data?.name || '');
            setEditPO(data?.data?.customerOrderNumber || data?.customerOrderNumber || '');
            setEditNotes(data?.data?.notes || data?.notes || '');
            setEditFulfillmentLocationId(data?.data?.fulfillmentLocationId || data?.fulfillmentLocationId || '');
            setHeaderDirty(false);

            if (autoTransitions && autoTransitions.length > 0) {
                const tr = autoTransitions[0];
                toast(tToast('orderMovedToReason', { state: tCommon(`states.${tr.to}` as any), reason: tr.reason.toLowerCase() }), { icon: '🔄' });
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
            const data = await apiFetch<OrderReturn[]>(`/api/sales-orders/${encodeURIComponent(id)}/returns`);
            setReturns(data);
        } catch {
            setReturns([]);
        } finally {
            setReturnsLoading(false);
        }
    };

    const loadInvoices = async () => {
        try {
            const res = await apiFetch<any>(`/api/sales-orders/${encodeURIComponent(id)}/invoices`);
            setInvoices(res?.data || res || []);
        } catch {
            setInvoices([]);
        }
    };

    /* ── Effects ─────────────────────────────────────────────────── */

    // Initial load
    useEffect(() => {
        loadOrder();
        apiFetch<TaxCategory[]>('/api/tax-categories').then(setTaxCategories).catch((err) => reportError(err, 'OrderDetailPage'));
    }, [id]);

    // Load returns and invoices when order state involves invoicing
    useEffect(() => {
        if (['shipped', 'picking', 'invoiced', 'legacy'].includes(order?.stateCode || '')) {
            loadInvoices();
        }
        if (order?.stateCode === 'invoiced' || order?.stateCode === 'legacy') {
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
            editPO !== (order.customerOrderNumber || '') ||
            editNotes !== (order.notes || '') ||
            editFulfillmentLocationId !== (order.fulfillmentLocationId || '');
        setHeaderDirty(changed);
    }, [editName, editPO, editNotes, editFulfillmentLocationId, order]);

    /* ── Mutations ───────────────────────────────────────────────── */

    const saveHeader = async () => {
        if (!headerDirty) return;
        setSaving(true);
        try {
            await apiMutate(`/api/sales-orders/${id}`, 'PATCH', {
                name: editName || null,
                customerOrderNumber: editPO || null,
                notes: editNotes || null,
                fulfillmentLocationId: editFulfillmentLocationId || null,
            });
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateOrder'));
        } finally {
            setSaving(false);
        }
    };

    const changeState = async (newState: string, generateBackorders?: boolean) => {
        try {
            await apiMutate(`/api/sales-orders/${id}/state`, 'PATCH', { stateCode: newState, generateBackorders });
            toast(tToast('orderMovedTo', { state: tCommon(`states.${newState}` as any) }), { icon: '🔄' });
            await loadOrder(undefined, false);
        } catch (err: any) {
            const isApiError = err && (err.status === 409 || err.name === 'ApiError');
            if (isApiError && err.data?.message === 'INVENTORY_GAP') {
                return err.data.gaps;
            }

            setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeState'));
        }
        return null;
    };

    const archiveOrder = async () => {
        if (!confirm(tConfirm('archiveOrder'))) return;
        setSaving(true);
        try {
            await apiMutate(`/api/sales-orders/${id}/archive`, 'POST');
            toast.success(tToast('orderArchived'));
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToArchive'));
        } finally {
            setSaving(false);
        }
    };

    const unarchiveOrder = async () => {
        setSaving(true);
        try {
            await apiMutate(`/api/sales-orders/${id}/unarchive`, 'POST');
            toast.success(tToast('orderUnarchived'));
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToUnarchive'));
        } finally {
            setSaving(false);
        }
    };

    const copyOrder = async () => {
        if (!order) return;
        setCopying(true);
        try {
            const newOrder = await apiMutate<{ salesOrderId: string }>('/api/sales-orders', 'POST', {
                name: order.name ? `Copy of ${order.name}` : undefined,
                customerId: order.customerId || undefined,
                customerOrderNumber: order.customerOrderNumber || undefined,
                notes: order.notes || undefined,
                fulfillmentLocationId: order.fulfillmentLocationId || undefined,
                lines: order.lines.map((l) => ({
                    productId: l.productId && l.productId !== '' ? l.productId : '00000000-0000-0000-0000-000000000000',
                    productDescription: l.productDescription,
                    quantity: l.quantity,
                    pricePerUnit: l.pricePerUnit,
                    discountPercentage: l.discountPercentage || '0',
                    taxCategoryId: l.taxCategoryId || undefined,
                    unitOfMeasure: l.unitOfMeasure || 'EA',
                })),
            });
            router.push(`/sales-orders/${newOrder.salesOrderId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToCopy'));
        } finally {
            setCopying(false);
        }
    };

    const updateLine = async (lineId: string, field: string, value: string) => {
        setSaving(true);
        try {
            await apiMutate(`/api/sales-orders/${id}/lines/${lineId}`, 'PATCH', { [field]: value });
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
            await apiMutate(`/api/sales-orders/${id}/lines/${lineId}`, 'PATCH', payload);
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
            await apiMutate(`/api/sales-orders/${id}/lines/${lineId}`, 'DELETE');
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToRemoveLine'));
        } finally {
            setSaving(false);
        }
    };

    const addLineFromProduct = async (p: Record<string, any>) => {
        if (!order) return;
        const exists = order.lines.some((l) => l.productId === p.productId);
        if (exists) {
            toast(tToast('productAlreadyInOrder', { productNumber: p.productNumber }), { icon: '⚠️' });
            return;
        }

        setSaving(true);
        try {
            const isPostConf = isOrderDetailsEditable && !isOrderLinesEditable;
            const url = isPostConf 
                ? `/api/sales-orders/${id}/post-confirmation-lines`
                : `/api/sales-orders/${id}/lines`;
            
            await apiMutate(url, 'POST', {
                productId: p.productId,
                productDescription: p.name,
                quantity: '1',
                pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
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
            const isPostConf = isOrderDetailsEditable && !isOrderLinesEditable;
            const url = isPostConf 
                ? `/api/sales-orders/${id}/post-confirmation-lines`
                : `/api/sales-orders/${id}/lines`;

            await apiMutate(url, 'POST', {
                productId: CUSTOM_LINE_ID,
                productDescription: isPostConf ? 'Additional Charge' : '',
                quantity: '1',
                pricePerUnit: '0.00',
                unitOfMeasure: 'EA',
            });
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToAddLine'));
        } finally {
            setSaving(false);
        }
    };

    const addPostConfirmationBlankLine = async () => {
        const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
        setSaving(true);
        try {
            await apiMutate(`/api/sales-orders/${id}/post-confirmation-lines`, 'POST', {
                productId: CUSTOM_LINE_ID,
                productDescription: 'Additional Charge',
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

    /* ── Computed values ─────────────────────────────────────────── */

    const isOrderDetailsEditable =
        !['cancelled', 'legacy', 'archived'].includes(order?.stateCode ?? '');

    const isOrderLinesEditable = order?.stateCode === 'draft';

    const allowedTransitions = STATE_TRANSITIONS[order?.stateCode ?? ''] || [];

    const subtotal = order?.lines.reduce(
        (sum, l) => sum + parseFloat(l.amount || '0'), 0,
    ) ?? 0;

    const totalTax = order?.lines.reduce(
        (sum, l) => sum + parseFloat(l.tax || '0'), 0,
    ) ?? 0;

    /* ── Return ──────────────────────────────────────────────────── */

    return {
        // Core
        order, loading, error, setError, saving, setSaving, copying, locations,

        // Header editing
        editName, setEditName, editPO, setEditPO, editNotes, setEditNotes, headerDirty,

        // GST
        taxCategories,

        // Tabs
        activeTab, setActiveTab, inventoryData, inventoryLoading,

        // Returns
        returns, returnsLoading, showCreateReturn, setShowCreateReturn,
        newReturnNotes, setNewReturnNotes, newReturnLines, setNewReturnLines,

        // Invoices
        invoices, invoicing, setInvoicing, showCreateInvoice, setShowCreateInvoice,
        pickingSummary, newInvoiceNotes, setNewInvoiceNotes,
        newInvoiceLines, setNewInvoiceLines,

        // Computed
        isOrderDetailsEditable, isOrderLinesEditable,
        allowedTransitions, subtotal, totalTax,

        // Mutations
        saveHeader, changeState, archiveOrder, unarchiveOrder, copyOrder,
        updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine, addPostConfirmationBlankLine,
        loadOrder, loadReturns, loadInvoices,
        editFulfillmentLocationId, setEditFulfillmentLocationId
    };
}
