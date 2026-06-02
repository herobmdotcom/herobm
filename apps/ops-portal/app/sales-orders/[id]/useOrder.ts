'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { reportError, ApiError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { 
    SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
    SALES_ORDER_STATE
} from '@modbm/shared';

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
        api.inventoryControllerFindAllLocations()
            .then((res) => {
                const payload = (res as any).data;
                const arr = Array.isArray(payload) ? payload : (payload?.data || []);
                setLocations(arr as { locationId: string; name: string }[]);
            })
            .catch((err) => reportError(err, 'Locations_Fetch'));
    }, []);

    /* ── Editable header fields ──────────────────────────────────── */
    const [editName, setEditName] = useState('');
    const [editPO, setEditPO] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editFulfillmentLocationId, setEditFulfillmentLocationId] = useState('');
    const [headerDirty, setHeaderDirty] = useState(false);
    const [discrepanciesAcknowledged, setDiscrepanciesAcknowledged] = useState(false);

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
            const [response, pData] = await Promise.all([
                api.ordersControllerFindOne(encodeURIComponent(id)),
                api.orderPickingControllerGetPickingSummary(encodeURIComponent(id)).catch(() => null),
            ]);
            const orderData = response.data as unknown as OrderDetail;
            if (orderData && !orderData.lines) {
                orderData.lines = [];
            }
            setOrder(orderData);
            setEditName(orderData?.name || '');
            setEditPO(orderData?.customerOrderNumber || '');
            setEditNotes(orderData?.notes || '');
            setEditFulfillmentLocationId(orderData?.fulfillmentLocationId || '');
            setDiscrepanciesAcknowledged(orderData?.discrepanciesAcknowledged || false);
            setPickingSummary(pData?.data);
            setHeaderDirty(false);

            if (autoTransitions && autoTransitions.length > 0) {
                const tr = autoTransitions[0];
                toast(tToast('orderMovedToReason', { state: tCommon(`states.${tr.to}` as Parameters<typeof tCommon>[0]), reason: tr.reason.toLowerCase() }), { icon: '🔄' });
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
            const res = await api.orderReturnsControllerFindReturns(encodeURIComponent(id));
            setReturns(res.data as unknown as OrderReturn[] || []);
        } catch {
            setReturns([]);
        } finally {
            setReturnsLoading(false);
        }
    };

    const loadInvoices = async () => {
        try {
            const res = await api.salesInvoiceControllerGetSalesInvoices(encodeURIComponent(id));
            setInvoices(((res.data as unknown as { data: SalesInvoice[] }).data || []));
        } catch {
            setInvoices([]);
        }
    };

    /* ── Effects ─────────────────────────────────────────────────── */

    // Initial load
    useEffect(() => {
        loadOrder();
        api.taxCategoriesControllerFindAll()
            .then(res => setTaxCategories(res.data.map(t => ({ ...t, taxCategoryId: (t as unknown as { id?: string }).id || t.taxCategoryId })) as unknown as TaxCategory[] || []))
            .catch(err => reportError(err, 'OrderDetailPage'));
    }, [id]);

    // Load returns and invoices when order state involves invoicing
    useEffect(() => {
        if ([SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.LEGACY, SALES_ORDER_STATE.PICKING, SALES_ORDER_STATE.SHIPPED].some(s => s === order?.stateCode)) {
            loadInvoices();
        }
        if ([
            SALES_ORDER_STATE.PICKING,
            SALES_ORDER_STATE.SHIPPED,
            SALES_ORDER_STATE.INVOICED, 
            SALES_ORDER_STATE.LEGACY
        ].some(s => s === order?.stateCode)) {
            loadReturns();
        }
    }, [order?.stateCode]);

    // Load inventory for highlighting shortages
    useEffect(() => {
        if (!order || order.lines.length === 0) return;
        
        const productIds = [...new Set(order.lines.map((l) => l.productId).filter(Boolean))];
        if (productIds.length === 0) return;
        
        setInventoryLoading(true);
        api.inventoryControllerFindByProductIdsBulk({ productIds })
            .then((res: unknown) => setInventoryData(((res as { data: unknown[] }).data) as InventoryLevel[]))
            .catch((err: any) => reportError(err, 'OrderDetailPage'))
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
            await api.ordersControllerUpdate(id, {
                name: editName || undefined,
                customerOrderNumber: editPO || undefined,
                notes: editNotes || undefined,
                fulfillmentLocationId: editFulfillmentLocationId || undefined,
            });
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateOrder'));
        } finally {
            setSaving(false);
        }
    };

    const changeState = async (newState: string, generateBackorders?: boolean, acknowledged?: boolean) => {
        try {
            await api.ordersControllerChangeState(id, { 
                stateCode: newState, 
                generateBackorders,
                discrepanciesAcknowledged: acknowledged
            });
            toast(tToast('orderMovedTo', { state: tCommon(`states.${newState}` as Parameters<typeof tCommon>[0]) }), { icon: '🔄' });
            await loadOrder(undefined, false);
        } catch (err: unknown) {
            const anyErr = err as any;
            const isApiError = anyErr && (anyErr.status === 409 || anyErr.name === 'ApiError');
            if (isApiError && anyErr.data?.message === 'INVENTORY_GAP') {
                return anyErr.data.gaps;
            }
            setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeState'));
            throw err;
        }
    };

    const calculateTaxes = async () => {
        setSaving(true);
        try {
            await api.ordersControllerTriggerTaxCalculation(encodeURIComponent(id), {});
            await loadOrder(undefined, false);
            toast.success('Taxes calculated successfully', { icon: '✅' });
        } catch (err) {
            reportError(err, 'OrderDetailPage');
            const msg = err instanceof ApiError ? err.message : 'Tax calculation failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const archiveOrder = async () => {
        if (!confirm(tConfirm('archiveOrder'))) return;
        setSaving(true);
        try {
            await api.ordersControllerArchive(id, { body: {} });
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
            await api.ordersControllerUnarchive(id, { body: {} });
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
            const res = await api.ordersControllerCreate({
                salesOrderId: crypto.randomUUID(),
                name: order.name ? `Copy of ${order.name}` : undefined,
                customerId: order.customerId || '',
                customerOrderNumber: order.customerOrderNumber || undefined,
                notes: order.notes || undefined,
                fulfillmentLocationId: order.fulfillmentLocationId || undefined,
                lines: order.lines.map((l) => ({
                    productId: l.productId && l.productId !== '' ? l.productId : '00000000-0000-0000-0000-000000000000',
                    productDescription: l.productDescription,
                    quantity: String(l.quantity),
                    pricePerUnit: String(l.pricePerUnit),
                    discountPercentage: String(l.discountPercentage || '0'),
                    taxCategoryId: l.taxCategoryId || undefined,
                    unitOfMeasure: l.unitOfMeasure || 'EA',
                })),
            });
            router.push(`/sales-orders/${res.data.salesOrderId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToCopy'));
        } finally {
            setCopying(false);
        }
    };

    const updateLine = async (lineId: string, field: string, value: string) => {
        setSaving(true);
        try {
            await api.ordersControllerUpdateLine(id, lineId, { [field]: value });
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateLine'));
        } finally {
            setSaving(false);
        }
    };

    // modbm-allow-record-any
    const updateLineFields = async (lineId: string, payload: Record<string, any>) => {
        setSaving(true);
        try {
            await api.ordersControllerUpdateLine(id, lineId, payload);
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
            await api.ordersControllerRemoveLine(id, lineId);
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToRemoveLine'));
        } finally {
            setSaving(false);
        }
    };

    // modbm-allow-record-any
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
            const payload = {
                productId: p.productId,
                productDescription: p.name,
                quantity: '1',
                pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
                unitOfMeasure: 'EA',
            };
            if (isPostConf) {
                await api.ordersControllerAddPostConfirmationLine(id, payload);
            } else {
                await api.ordersControllerAddLine(id, payload);
            }
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
            const payload = {
                productId: CUSTOM_LINE_ID,
                productDescription: isPostConf ? 'Additional Charge' : '',
                quantity: '1',
                pricePerUnit: '0.00',
                unitOfMeasure: 'EA',
            };
            if (isPostConf) {
                await api.ordersControllerAddPostConfirmationLine(id, payload);
            } else {
                await api.ordersControllerAddLine(id, payload);
            }
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
            await api.ordersControllerAddPostConfirmationLine(id, {
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
        !([SALES_ORDER_STATE.CANCELLED, SALES_ORDER_STATE.LEGACY, SALES_ORDER_STATE.ARCHIVED] as string[]).includes((order?.stateCode as string) ?? '');

    const isOrderLinesEditable = order?.stateCode === SALES_ORDER_STATE.DRAFT;

    const isHeaderEditable = order?.stateCode !== SALES_ORDER_STATE.ARCHIVED && order?.stateCode !== SALES_ORDER_STATE.CANCELLED && order?.stateCode !== SALES_ORDER_STATE.LEGACY;

    const allowedTransitions = STATE_TRANSITIONS[order?.stateCode ?? ''] || [];

    const subtotal = order?.lines?.reduce(
        (sum, l) => sum + parseFloat(l.amount || '0'), 0,
    ) ?? 0;

    const totalTax = order?.lines?.reduce(
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
        saveHeader, changeState, calculateTaxes, archiveOrder, unarchiveOrder, copyOrder,
        updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine, addPostConfirmationBlankLine,
        loadOrder, loadReturns, loadInvoices,
        editFulfillmentLocationId, setEditFulfillmentLocationId,
        discrepanciesAcknowledged, setDiscrepanciesAcknowledged
    };
}
