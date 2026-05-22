'use client';

import { use, useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { apiMutate, reportError } from '@/lib/api';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

import PageNav from '@/components/shared/PageNav';

import InvoicesSection from './InvoicesSection';
import ReturnsSection from './ReturnsSection';
import FulfillmentSection from './FulfillmentSection';
import ShipmentsSection from './ShipmentsSection';
import QuoteGenerationDialog from './QuoteGenerationDialog';
import { formatLocationDisplay } from '@/lib/formatters';

import type { TaxCategory } from './types';
import { getTaxLabel } from './types';
import { useOrder } from './useOrder';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import {
    RETURN_STATE,
    RETURN_TRANSITIONS,
    RETURN_LIFECYCLE,
    SALES_ORDER_STATE,
    SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
    PURCHASE_ORDER_STATE,
    BACKORDER_STATE,
    isBackTransition as sharedIsBackTransition,
    cap,
    calculateUomPriceAdjustment,
    calculateInventoryGaps
} from '@modbm/shared';
import type { ProductUom } from '@modbm/shared';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function isBackTransition(
    from: string, to: string,
    lifecycle: Record<string, number> = ORDER_LIFECYCLE,
): boolean {
    return sharedIsBackTransition(lifecycle, from, to);
}


function EventIcon({ type }: { type: string }) {
    const t = useTranslations('common.eventTypes');
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
        archived: '📦',
        unarchived: '📦',
        shipment_created: '🚚',
        shipment_updated: '🚚',
        shipment_status_changed: '🚚',
        shipment_processed: '📫',
        shipment_line_added: '📦',
        shipment_line_updated: '📦',
        shipment_line_removed: '🗑️',
        picking_line_updated: '📦',
        picking_line_picked_all: '✅',
        picking_order_picked_all: '✅',
        return_created: '↩️',
        return_updated: '✏️',
        return_status_changed: '🔄',
        return_processed: '✅',
        return_line_added: '➕',
        return_line_updated: '✏️',
        return_line_removed: '🗑️',
    };
    return <span className="mr-2" style={{ fontSize: '1.2rem', lineHeight: 1 }} title={t(type as any)}>{icons[type] || '📌'}</span>;
}

function PurchaseReturnStateBadge({ state }: { state: ValidState }) {
    const t = useTranslations('common.states');
    return <span className={`badge badge-return-${state}`}>{t(state)}</span>;
}



export default function SalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const t = useTranslations();
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    const tToast = useTranslations('toast');
    const tConfirm = useTranslations('confirm');

    const o = useOrder(id);

    /* ── Post-Confirmation Line UI State ───────────────────────────── */
    const [isPostConfirmationAddingEnabled, setIsPostConfirmationAddingEnabled] = useState(false);

    /* ── Quote Dialog ──────────────────────────────────────────────────────── */
    const [showQuoteDialog, setShowQuoteDialog] = useState(false);

    /* ── Discrepancy Modal ─────────────────────────────────────────────────── */
    const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

    // Scroll to hash fragment (e.g. #invoices-section) after data loads
    useEffect(() => {
        if (o.loading || !o.order) return;
        const hash = window.location.hash;
        if (!hash) return;
        // Small delay to let sections render
        const timer = setTimeout(() => {
            const el = document.querySelector(hash);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timer);
    }, [o.loading, o.order]);

    useDocumentTitle(o.order ? (o.order.name ? `${o.order.orderNumber} - ${o.order.name}` : o.order.orderNumber) : null);

    if (o.loading) {
        return (
            <>
                <div className="flex items-center justify-center flex-1">
                    <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
                </div>
            </>
        );
    }

    if (!o.order) {
        return (
            <>
                <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
                        {o.error || tSales('orderNotFound')}
                    </p>
                    <button className="btn btn-secondary" onClick={() => router.push('/sales-orders')}>
                        {tSales('backToOrders')}
                    </button>
                </div>
            </>
        );
    }

    // After null guard, destructure everything for JSX use
    const {
        order, error, setError, saving, copying, locations,
        editName, setEditName, editPO, setEditPO, editNotes, setEditNotes, editFulfillmentLocationId, setEditFulfillmentLocationId, headerDirty,
        taxCategories,
        activeTab, setActiveTab, inventoryData, inventoryLoading,
        returns, returnsLoading, showCreateReturn, setShowCreateReturn,
        invoices, pickingSummary,
        isOrderDetailsEditable, isOrderLinesEditable,
        allowedTransitions, subtotal, totalTax,
        saveHeader, changeState, archiveOrder, unarchiveOrder, copyOrder,
        updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine, addPostConfirmationBlankLine,
        loadOrder, loadReturns, loadInvoices,
        discrepanciesAcknowledged, setDiscrepanciesAcknowledged
    } = o;

    const handleStateClick = async (state: string) => {
        if (state === SALES_ORDER_STATE.CONFIRMED && gaps.length > 0 && !discrepanciesAcknowledged) {
            setShowDiscrepancyModal(true);
            return;
        }
        await changeState(state, state === SALES_ORDER_STATE.CONFIRMED, discrepanciesAcknowledged);
    };

    const handleGenerateQuote = async (text: string) => {
        try {
            const { apiFetchBlob } = await import('@/lib/api');
            const blob = await apiFetchBlob(`/api/reports/hooks/sales-order-quote/run?id=${id}&context=sales-order`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quoteIntroText: text })
            });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            loadOrder(); // Reload to show the new timeline event
        } catch (err) {
            reportError(err, 'OrderDetailPage:generateQuote');
            setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateQuote'));
            throw err;
        }
    };

    /* ── Centralised section visibility rules ──────────────────────── */
    const PICKING_INVOICE_STATES: string[] = [
        SALES_ORDER_STATE.PICKING, 
        SALES_ORDER_STATE.SHIPPED, 
        SALES_ORDER_STATE.INVOICED, 
        SALES_ORDER_STATE.LEGACY, 
        SALES_ORDER_STATE.ARCHIVED
    ];
    const sections = {
        details:      { id: 'details-section',      label: 'Details',      show: true },
        lines:        { id: 'lines-section',        label: 'Lines',        show: true },
        fulfillment:  { id: 'fulfillment-section',  label: 'Fulfillment',  show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        shipments:    { id: 'shipments-section',    label: 'Shipments',    show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        invoices:     { id: 'invoices-section',     label: 'Invoices',     show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        returns:      { id: 'returns-section',      label: 'Returns',      show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        activity:     { id: 'activity-section',     label: 'Activity',     show: true },
    };
    const visibleSections = Object.values(sections).filter(s => s.show);
    
    // Pre-calculate gaps for the Availability tab
    const gaps = calculateInventoryGaps(
        order.lines, 
        inventoryData.map(inv => ({ 
            productId: inv.productId, 
            locationId: inv.locationId, 
            quantityAvailable: inv.quantityAvailable 
        })), 
        order.fulfillmentLocationId
    );
    const gapMap = new Map(gaps.map(g => [g.salesOrderLineId, g]));

    return (
        <>
            <DetailsLayout
                header={
                    <EntityHeader
                        title={order.orderNumber}
                        subtitle={order.name || tSales('untitledOrder')}
                        onBack={() => router.push('/sales-orders')}
                        isSaving={saving}
                        badges={<StateBadge state={order.stateCode as ValidState} />}
                        actions={
                            <>
                                {/* Section quick nav */}
                                <PageNav sections={visibleSections} />


                                {headerDirty && isOrderDetailsEditable && (
                                    <button className="btn btn-primary btn-sm" onClick={saveHeader} disabled={saving}>
                                        {tSales('buttons.save')}
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
                                                className={`btn btn-sm ${state === SALES_ORDER_STATE.CANCELLED ? 'btn-danger' : back ? 'btn-secondary' : 'btn-primary'
                                                    }`}
                                                onClick={() => handleStateClick(state)}
                                            >
                                                {state === SALES_ORDER_STATE.CANCELLED ? (
                                                    <>
                                                        <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                                                        {tCommon('cancel')}
                                                    </>
                                                ) : back ? (
                                                    <>← <StateName state={state as ValidState} /></>
                                                ) : (
                                                    <>→ <StateName state={state as ValidState} /></>
                                                )}
                                            </button>
                                        );
                                    })}
                            </>
                        }
                    />
                }
            >



            {order.stateCode === SALES_ORDER_STATE.ARCHIVED && (
                <div
                    className="mb-4 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
                    style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#b45309',
                    }}
                >
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <div>
                        <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                    {/* Order info card */}
                    <div id="details-section" className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="section-heading">
                                {/* eslint-disable-next-line i18next/no-literal-string */}
                                <span className="material-symbols-outlined">receipt_long</span>
                                {tSales('orderDetails')}
                            </h3>
                            <div className="flex items-center gap-2">
                                {(order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED) && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowQuoteDialog(true)}
                                    >
                                        {tSales('buttons.createQuote')}
                                    </button>
                                )}
                                {(order.stateCode !== SALES_ORDER_STATE.DRAFT && order.stateCode !== SALES_ORDER_STATE.QUOTED) && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={async () => {
                                            try {
                                                const { apiFetchBlob } = await import('@/lib/api');
                                                const blob = await apiFetchBlob(`/api/reports/hooks/sales-order-confirmation/run?id=${id}&context=sales-order`, { method: 'POST' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            } catch (err) {
                                                reportError(err, 'OrderDetailPage:generateConfirmation');
                                                setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                            }
                                        }}
                                    >
                                        {tSales('buttons.confirmationPdf')}
                                    </button>
                                )}
                                {(order.stateCode === SALES_ORDER_STATE.CONFIRMED || order.stateCode === SALES_ORDER_STATE.PICKING) && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={async () => {
                                            try {
                                                const { apiFetchBlob } = await import('@/lib/api');
                                                const blob = await apiFetchBlob(`/api/reports/hooks/pro-forma-invoice/run?id=${id}&context=sales-order`, { method: 'POST' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            } catch (err) {
                                                reportError(err, 'OrderDetailPage:generateProForma');
                                                setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                            }
                                        }}
                                    >
                                        {tSales('buttons.proFormaInvoice')}
                                    </button>
                                )}
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={copyOrder}
                                    disabled={copying}
                                >
                                    {copying ? tCommon('copying') : tSales('buttons.copyOrder')}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('labels.customer')}
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
                                    {order.customerName || order.customerId ? (
                                        <Link 
                                            href={`/customers/${order.customerId}`} 
                                            style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                            className="hover:underline"
                                        >
                                            {order.customerName || <span style={{ fontStyle: 'italic' }}>{tSales('unnamedCustomer')}</span>}
                                        </Link>
                                    ) : (
                                        '—'
                                    )}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('labels.created')}
                                </label>
                                <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                                    {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy || '—'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('labels.orderName')}
                                </label>
                                <input
                                    className="input"
                                    disabled={!isOrderDetailsEditable}
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={saveHeader}
                                    placeholder={tSales('placeholders.orderName')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('labels.customerPO')}
                                </label>
                                <input
                                    className="input"
                                    disabled={!isOrderDetailsEditable}
                                    value={editPO}
                                    onChange={(e) => setEditPO(e.target.value)}
                                    onBlur={saveHeader}
                                    placeholder={tSales('placeholders.customerPO')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('labels.fulfillmentLocation')}
                                </label>
                                <select
                                    className="input"
                                    disabled={!isOrderDetailsEditable}
                                    value={editFulfillmentLocationId}
                                    onChange={(e) => setEditFulfillmentLocationId(e.target.value)}
                                    onBlur={saveHeader}
                                >
                                    {locations.map((loc: { locationId: string; name: string; code?: string }) => (
                                        <option key={loc.locationId} value={loc.locationId}>
                                            {formatLocationDisplay(loc)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {tCommon('notesCardHeading')}
                                </label>
                                <input
                                    className="input"
                                    disabled={!isOrderDetailsEditable}
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    onBlur={saveHeader}
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
                                {tSales('lineItems')}
                            </button>
                            <button
                                className="text-xs font-medium px-3 py-1.5"
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
                                {tSales('availability')}
                            </button>
                            <button
                                className="text-xs font-medium px-3 py-1.5 rounded-r-lg"
                                style={{
                                    color: activeTab === 'backorders' ? 'var(--accent)' : 'var(--text-muted)',
                                    background: activeTab === 'backorders' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: '1px solid',
                                    borderColor: activeTab === 'backorders' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                                    borderLeft: activeTab === 'backorders' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveTab('backorders')}
                            >
                                {tSales('backordersTab')}
                            </button>
                        </div>
                        {(isOrderLinesEditable || (isOrderDetailsEditable && activeTab === 'lines' && isPostConfirmationAddingEnabled)) && (
                            <>
                                <ProductSearchInput
                                    onSelect={addLineFromProduct}
                                    placeholder={tSales('placeholders.searchProduct')}
                                    style={{ width: 240 }}
                                    fulfillmentLocationId={order?.fulfillmentLocationId || undefined}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={addBlankLine}
                                    disabled={saving}
                                >
                                    + {tSales('buttons.customLine')}
                                </button>
                            </>
                        )}
                        {!isOrderLinesEditable && isOrderDetailsEditable && activeTab === 'lines' && !isPostConfirmationAddingEnabled && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    if (window.confirm(tSales('postConfirmationLineWarningBody'))) {
                                        setIsPostConfirmationAddingEnabled(true);
                                    }
                                }}
                                disabled={saving}
                                title={tSales('postConfirmationLineWarningTitle')}
                            >
                                + {tSales('buttons.addPostConfirmationLine')}
                            </button>
                        )}
                    </div>

                    {activeTab === 'lines' ? (
                        <>
                        <table className="table-lines">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>{tSales('columns.lineNumber')}</th>
                                    <th>{tSales('columns.product')}</th>
                                    <th>{tSales('columns.description')}</th>
                                    <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.qty')}</th>
                                    <th style={{ width: 80, textAlign: 'right' }}>{tSales('columns.uom')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.unitPrice')}</th>
                                    <th style={{ width: 80, textAlign: 'right' }}>{tSales('columns.discountPct')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.tax')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.amount')}</th>
                                    {(isOrderLinesEditable || order.lines.some(l => l.isPostConfirmation && isOrderDetailsEditable) || isPostConfirmationAddingEnabled) && <th style={{ width: 50 }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {order.lines.map((line: any, idx: number) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    return (
                                    <tr key={line.salesOrderLineId || idx}>
                                        <td style={{ 
                                            color: 'var(--text-muted)',
                                            fontWeight: 400,
                                            position: 'relative'
                                        }}>
                                            {line.lineNumber}
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: 12 }}>
                                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                    {line.productNumber || line.productId?.substring(0, 8)}
                                                </Link>
                                            ) : (
                                                line.productNumber || line.productId?.substring(0, 8) || '—'
                                            )}
                                            {line.isPostConfirmation && (
                                                <span className="ml-2 badge badge-sm badge-accent">
                                                    {tSales('columns.postConfirmation')}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {(!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isEditable ? (
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
                                        {isEditable ? (
                                            <>
                                                <td style={{ textAlign: 'right', position: 'relative' }}>
                                                    {gapMap.has(line.salesOrderLineId) && (
                                                        <span 
                                                            className="material-symbols-outlined" 
                                                            style={{ 
                                                                fontSize: 14, 
                                                                position: 'absolute',
                                                                left: -16,
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                color: 'var(--danger)',
                                                                zIndex: 1
                                                            }}
                                                            title={tSales('availabilityStatus.shortage')}
                                                        >
                                                            warning
                                                        </span>
                                                    )}
                                                    <input
                                                        className="input"
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        style={{ 
                                                            width: '100%', 
                                                            textAlign: 'right',
                                                            borderColor: gapMap.has(line.salesOrderLineId) ? 'var(--danger)' : undefined
                                                        }}
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
                                                                        updateLineFields(line.salesOrderLineId, {
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
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: gapMap.has(line.salesOrderLineId) ? 'var(--danger)' : undefined, fontWeight: gapMap.has(line.salesOrderLineId) ? 600 : undefined }}>
                                                    {gapMap.has(line.salesOrderLineId) && (
                                                        <span 
                                                            className="material-symbols-outlined" 
                                                            style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4, color: 'var(--danger)' }}
                                                            title={tSales('availabilityStatus.shortage')}
                                                        >
                                                            warning
                                                        </span>
                                                    )}
                                                    {line.quantity}
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    {/* eslint-disable-next-line no-restricted-syntax */}
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
                                        {isEditable ? (
                                            <td style={{ textAlign: 'right' }}>
                                                <select
                                                    className="input"
                                                    style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                                                    value={line.taxCategoryId || ''}
                                                    onChange={(e) => {
                                                        updateLine(line.salesOrderLineId, 'taxCategoryId', e.target.value);
                                                    }}
                                                >
                                                    {taxCategories.map((c: TaxCategory) => (
                                                        <option key={c.taxCategoryId} value={c.taxCategoryId}>
                                                            {getTaxLabel(c)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        ) : (
                                            <td style={{ textAlign: 'right', fontSize: 12 }}>
                                                {(() => {
                                                    const c = taxCategories.find((c: TaxCategory) => c.taxCategoryId === line.taxCategoryId);
                                                    if (c) return getTaxLabel(c);
                                                    // ABM legacy: derive effective rate from tax / amount
                                                    const amt = parseFloat(line.amount || '0');
                                                    const tax = parseFloat(line.tax || '0');
                                                    if (amt > 0 && tax > 0) {
                                                        const pct = (tax / amt) * 100;
                                                        return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                                                    }
                                                    if (amt > 0 && tax === 0) return tCommon('taxLabels.exempt');
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
                                        {(isOrderLinesEditable || order.lines.some(l => l.isPostConfirmation && isOrderDetailsEditable)) && (
                                            <td>
                                                {isEditable && (
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => removeLine(line.salesOrderLineId)}
                                                        title={tSales('buttons.removeLine')}
                                                    >
                                                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                                })}
                                {order.lines.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={isOrderLinesEditable ? 9 : 8}
                                            style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                                        >
                                            {tSales('noLineItems')}
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
                                                {isOrderLinesEditable && <td></td>}
                                            </tr>
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(totalTax, order.currencyCode || 'EUR')}
                                                </td>
                                                {isOrderLinesEditable && <td></td>}
                                            </tr>
                                            <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                                    {tCommon('total')}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                                                </td>
                                                {isOrderLinesEditable && <td></td>}
                                            </tr>
                                        </>
                                    );
                                })()}
                            </tbody>
                        </table>
                        
                        </>
                    ) : activeTab === 'availability' ? (
                        /* Availability tab */
                        inventoryLoading ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tSales('loadingInventory')}</p>
                        ) : (
                            <table className="table-lines">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>{tSales('columns.lineNumber')}</th>
                                        <th>{tSales('columns.product')}</th>
                                        <th>{tSales('columns.description')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.ordered')}</th>
                                        <th style={{ width: 140, textAlign: 'left' }}>{tSales('columns.fulfillment')}</th>
                                        <th style={{ width: 100, textAlign: 'right' }}>{tSales('columns.location')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.onHand')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.committed')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.incoming')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.available')}</th>
                                        <th style={{ width: 70, textAlign: 'center' }}>{tSales('columns.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.lines.map((line: any, idx: number) => {
                                        const lineInventory = inventoryData.filter(
                                            (inv: any) => inv.productId === line.productId && line.productId !== '00000000-0000-0000-0000-000000000000',
                                        );
                                        const totalAvail = lineInventory.reduce(
                                            (sum: number, inv: any) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                                        );
                                        const gap = gapMap.get(line.salesOrderLineId);
                                        const canFulfil = !gap;

                                        const isCustom = !line.productId || line.productId === '00000000-0000-0000-0000-000000000000';
                                        if (line.productType === 'non-stock' || line.productType === 'service' || isCustom) {
                                            return (
                                                <tr key={line.salesOrderLineId} style={{ backgroundColor: 'var(--bg-subtle)' }}>
                                                    <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                                                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                                    </td>
                                                    <td>
                                                        {line.productDescription || '—'}
                                                        <span className="ml-2 badge badge-sm badge-draft">
                                                            {/* eslint-disable-next-line no-restricted-syntax */}
                                                            {line.productType || 'custom'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                                                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                                                        {tSales('virtualFulfillmentBypass')}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>✅</td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <Fragment key={line.salesOrderLineId || idx}>
                                                {lineInventory.length === 0 ? (
                                                    <tr key={line.salesOrderLineId}>
                                                        <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                                        <td style={{ fontWeight: 600, fontSize: 12 }}>
                                                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                                <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                                    {line.productNumber}
                                                                </Link>
                                                            ) : (
                                                                line.productNumber || '—'
                                                            )}
                                                        </td>
                                                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{line.productDescription}</td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                                                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 12, fontStyle: 'italic' }}>
                                                            {tSales('noInventoryFound')}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>❌</td>
                                                    </tr>
                                                ) : lineInventory.map((inv: any, idx: number) => (
                                                    <tr key={`${line.salesOrderLineId}-${inv.locationId}`}>
                                                        {idx === 0 && (
                                                            <>
                                                                <td rowSpan={lineInventory.length} style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                                                <td rowSpan={lineInventory.length} style={{ fontWeight: 600, fontSize: 12 }}>
                                                                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                                        <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                                            {line.productNumber}
                                                                        </Link>
                                                                    ) : (
                                                                        line.productNumber || '—'
                                                                    )}
                                                                </td>
                                                                <td rowSpan={lineInventory.length} style={{ fontSize: 12 }}>{line.productDescription}</td>
                                                                <td rowSpan={lineInventory.length} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{line.quantity}</td>
                                                                <td rowSpan={lineInventory.length}>
                                                                    {(() => {
                                                                        if (canFulfil) {
                                                                            return <span className="text-emerald-600 font-medium flex items-center gap-1">✅ {tSales('availabilityStatus.local')}</span>;
                                                                        }
                                                                        if (gap && totalAvail >= gap.orderedQuantity) {
                                                                            return <span className="text-amber-600 font-medium flex items-center gap-1">🚚 {tSales('availabilityStatus.others')}</span>;
                                                                        }
                                                                        return <span className="text-rose-600 font-medium flex items-center gap-1">❌ {tSales('availabilityStatus.shortage')}</span>;
                                                                    })()}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td style={{ textAlign: 'right', fontSize: 12, color: inv.locationId === order.fulfillmentLocationId ? 'var(--accent)' : 'var(--text-muted)', fontWeight: inv.locationId === order.fulfillmentLocationId ? 600 : 400 }}>
                                                            {inv.locationName}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(inv.quantityOnHand || '0')}</td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--danger)' }}>{parseFloat(inv.quantityCommitted || '0')}</td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--success)' }}>{parseFloat(inv.quantityOnOrder || '0')}</td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: parseFloat(inv.quantityAvailable || '0') > 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                                                            {parseFloat(inv.quantityAvailable || '0')}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {parseFloat(inv.quantityAvailable || '0') >= Number(line.quantity) ? '✅' : '⚠️'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* Backorders tab */
                        <div>
                            {order.backorders && order.backorders.length > 0 ? (
                                <table className="table-lines">
                                    <thead>
                                        <tr>
                                            <th>{tSales('columns.lineNumber')}</th>
                                            <th>{tSales('columns.product')}</th>
                                            <th>{tSales('columns.allocatedTo')}</th>
                                            <th>{tSales('columns.status')}</th>
                                            <th>{tSales('columns.demandDate')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.backorders.map((bo: any, bo_idx: number) => {
                                            const isPo = !!bo.purchaseOrderId;
                                            const displayOrderNumber = isPo ? bo.purchaseOrderNumber || '—' : '—';
                                            const displayStatus = isPo ? bo.purchaseOrderState || PURCHASE_ORDER_STATE.DRAFT : bo.stateCode || BACKORDER_STATE.PENDING_SUPPLY;
                                            
                                            return (
                                                <tr 
                                                    key={bo_idx} 
                                                    className={isPo ? "cursor-pointer hover:bg-gray-50" : ""} 
                                                    onClick={() => {
                                                        if (isPo) {
                                                            router.push(`/purchase-orders/${bo.purchaseOrderId}`);
                                                        }
                                                    }}
                                                >
                                                    <td className="w-12 text-center text-[var(--text-muted)] font-medium">
                                                        {bo.lineNumber || '—'}
                                                    </td>
                                                    <td>
                                                        {bo.productNumber || '—'}
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bo.quantity} demanded</div>
                                                    </td>
                                                    <td style={{ color: isPo ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 400 }}>{displayOrderNumber}</td>
                                                    <td>
                                                        {isPo ? (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className="badge badge-sm badge-success">Allocated</span>
                                                                <StateBadge state={bo.purchaseOrderState as ValidState} />
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-draft">Open Demand</span>
                                                        )}
                                                    </td>
                                                    <td>{new Date(bo.createdOn).toLocaleDateString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {tSales('noBackordersFound')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {sections.fulfillment.show && (
                    <FulfillmentSection orderId={id} pickingSummary={pickingSummary} />
                )}

                {sections.shipments.show && (
                    <ShipmentsSection orderId={id} />
                )}

                {sections.invoices.show && (
                    <InvoicesSection 
                        orderId={id}
                        order={order} 
                        invoices={invoices} 
                        taxCategories={taxCategories}
                        pickingSummary={pickingSummary}
                        setError={setError}
                        loadInvoices={loadInvoices}
                        loadOrder={loadOrder}
                    />
                )}

                {sections.returns.show && (
                    <ReturnsSection 
                        orderId={id}
                        order={order} 
                        returns={returns} 
                        returnsLoading={returnsLoading}
                        showCreateReturn={showCreateReturn}
                        setShowCreateReturn={setShowCreateReturn} 
                        setError={setError}
                        loadReturns={loadReturns}
                        loadOrder={loadOrder}
                        pickingSummary={pickingSummary}
                        taxCategories={taxCategories}
                        locations={locations}
                    />
                )}

                <div id="activity-section" className="card">
                    <ActivityTimeline events={order.events} />
                </div>
            </div>

            </DetailsLayout>

            <QuoteGenerationDialog
                isOpen={showQuoteDialog}
                onClose={() => setShowQuoteDialog(false)}
                onGenerate={handleGenerateQuote}
            />

            {showDiscrepancyModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">{tSales('discrepancies.title')}</h2>
                            <button onClick={() => setShowDiscrepancyModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 flex flex-col gap-4">
                            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.lineNumber')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.product')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.description')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">{tSales('columns.ordered')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">{tSales('columns.available')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right text-red-600">{tSales('columns.gap')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {order.lines
                                            .filter(l => gapMap.has(l.salesOrderLineId))
                                            .map((line: any) => {
                                                const gap = gapMap.get(line.salesOrderLineId);
                                                return (
                                                    <tr key={line.salesOrderLineId} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-gray-500 font-medium">{line.lineNumber}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-900 font-bold">{line.productNumber}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[150px]" title={line.productDescription}>{line.productDescription}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-900 text-right font-medium">{gap?.orderedQuantity}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600 text-right">{gap?.availableQuantity}</td>
                                                        <td className="px-4 py-3 text-xs text-red-600 text-right font-bold">{gap?.shortage}</td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowDiscrepancyModal(false)}
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={async () => {
                                        setDiscrepanciesAcknowledged(true);
                                        setShowDiscrepancyModal(false);
                                        await changeState(SALES_ORDER_STATE.CONFIRMED, true, true);
                                    }}
                                >
                                    {tCommon('confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .table-lines {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 1.5rem;
                }
                .table-lines th {
                    text-align: left;
                    padding: 10px 12px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-muted);
                    border-bottom: 2px solid var(--border);
                }
                .table-lines td {
                    padding: 12px;
                    font-size: 13px;
                    border-bottom: 1px solid var(--border);
                    vertical-align: middle;
                }

                .badge-draft { background: #f3f4f6; color: #374151; }
                .badge-quoted { background: #e0f2fe; color: #0369a1; }
                .badge-confirm { background: #ecfdf5; color: #047857; }
            `}</style>
        </>
    );
}
