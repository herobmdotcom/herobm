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

import PickingSection from '@/components/shared/PickingSection';
import PageNav from '@/components/shared/PageNav';

import InvoicesSection from './InvoicesSection';
import ReturnsSection from './ReturnsSection';
import { formatLocationDisplay } from '@/lib/formatters';

import type { GstCategory } from './types';
import { getGstLabel } from './types';
import { useOrder } from './useOrder';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import {
    RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
    SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
    RETURN_LIFECYCLE,
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

function ReturnStateBadge({ state }: { state: ValidState }) {
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

    /* ── Gap / Backorder Modal State ───────────────────────────────── */
    const [gapModalOpen, setGapModalOpen] = useState(false);
    const [pendingGaps, setPendingGaps] = useState<any[]>([]);
    const [pendingStateChange, setPendingStateChange] = useState('');
    const [selectedGapOption, setSelectedGapOption] = useState<'backorder' | 'ignore'>('backorder');

    /* ── Post-Confirmation Line UI State ───────────────────────────── */
    const [isPostConfirmationAddingEnabled, setIsPostConfirmationAddingEnabled] = useState(false);

    /* ── Picking/Shipments visibility (driven by PickingSection's internal state) ── */
    const [pickingVis, setPickingVis] = useState({ picking: false, shipments: false });
    const onPickingVisibilityChange = useCallback(
        (v: { picking: boolean; shipments: boolean }) => setPickingVis(v), [],
    );

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
        gstCategories,
        activeTab, setActiveTab, inventoryData, inventoryLoading,
        returns, returnsLoading, showCreateReturn, setShowCreateReturn,
        invoices, pickingSummary,
        isOrderDetailsEditable, isOrderLinesEditable,
        allowedTransitions, subtotal, totalTax,
        saveHeader, changeState, archiveOrder, unarchiveOrder, copyOrder,
        updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine, addPostConfirmationBlankLine,
        loadOrder, loadReturns, loadInvoices,
    } = o;

    const handleStateClick = async (state: string) => {
        const result = await changeState(state);
        if (Array.isArray(result) && result.length > 0) {
            setPendingGaps(result);
            setPendingStateChange(state);
            setGapModalOpen(true);
        }
    };

    const confirmWithBackorders = async () => {
        setGapModalOpen(false);
        await changeState(pendingStateChange, true); // true = generateBackorders
    };

    const confirmWithoutBackorders = async () => {
        setGapModalOpen(false);
        await changeState(pendingStateChange, false);
    };

    /* ── Centralised section visibility rules ──────────────────────── */
    const PICKING_INVOICE_STATES = ['picking', 'shipped', 'invoiced', 'legacy', 'archived'];
    const sections = {
        details:   { id: 'details-section',   label: 'Details',   show: true },
        lines:     { id: 'lines-section',     label: 'Lines',     show: true },
        picking:   { id: 'picking-section',   label: 'Picking',   show: pickingVis.picking },
        shipments: { id: 'shipments-section', label: 'Shipments', show: pickingVis.shipments },
        invoices:  { id: 'invoices-section',  label: 'Invoices',  show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        returns:   { id: 'returns-section',   label: 'Returns',   show: PICKING_INVOICE_STATES.includes(order.stateCode) },
        activity:  { id: 'activity-section',  label: 'Activity',  show: true },
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
                                                className={`btn btn-sm ${state === 'cancelled' ? 'btn-danger' : back ? 'btn-secondary' : 'btn-primary'
                                                    }`}
                                                onClick={() => handleStateClick(state)}
                                            >
                                                {state === 'cancelled' ? <><span dangerouslySetInnerHTML={{ __html: '&#10005;&nbsp;' }} /><StateName state={state as ValidState} /></> : back ? <>← <StateName state={state as ValidState} /></> : <>→ <StateName state={state as ValidState} /></>}
                                            </button>
                                        );
                                    })}
                            </>
                        }
                    />
                }
            >



            {order.stateCode === 'archived' && (
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
                                {(order.stateCode === 'draft' || order.stateCode === 'quoted') && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={async () => {
                                            try {
                                                const { apiFetchBlob } = await import('@/lib/api');
                                                const blob = await apiFetchBlob(`/api/reports/hooks/sales-order-quote/run?id=${id}&context=sales-order`, { method: 'POST' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            } catch (err) {
                                                reportError(err, 'OrderDetailPage:generateQuote');
                                                setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateQuote'));
                                            }
                                        }}
                                    >
                                        {tSales('buttons.createQuote')}
                                    </button>
                                )}
                                {(order.stateCode !== 'draft' && order.stateCode !== 'quoted') && (
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
                                {(order.stateCode === 'confirmed' || order.stateCode === 'picking') && (
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
                                    {order.customerName
                                        ? order.customerName
                                        : order.customerId
                                            ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{tSales('unnamedCustomer')}</span>
                                            : '—'}
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
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.gst')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.amount')}</th>
                                    {(isOrderLinesEditable || order.lines.some(l => l.isPostConfirmation && isOrderDetailsEditable) || isPostConfirmationAddingEnabled) && <th style={{ width: 50 }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {order.lines.map((line: any, idx: number) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    return (
                                    <tr key={line.salesOrderLineId || idx}>
                                        <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                        <td style={{ fontWeight: 600, fontSize: 12 }}>
                                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                    {line.productNumber || line.productId?.substring(0, 8)}
                                                </Link>
                                            ) : (
                                                line.productNumber || line.productId?.substring(0, 8) || '—'
                                            )}
                                            {line.isPostConfirmation && (
                                                <span className="ml-2 badge" style={{ fontSize: 10, padding: '2px 4px', background: 'var(--accent)', color: 'white', borderRadius: 4 }}>
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
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
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
                                                    value={line.gstCategoryId || ''}
                                                    onChange={(e) => {
                                                        updateLine(line.salesOrderLineId, 'gstCategoryId', e.target.value);
                                                    }}
                                                >
                                                    {gstCategories.map((c: GstCategory) => (
                                                        <option key={c.gstCategoryId} value={c.gstCategoryId}>
                                                            {getGstLabel(c)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        ) : (
                                            <td style={{ textAlign: 'right', fontSize: 12 }}>
                                                {(() => {
                                                    const c = gstCategories.find((c: GstCategory) => c.gstCategoryId === line.gstCategoryId);
                                                    if (c) return getGstLabel(c);
                                                    // ABM legacy: derive effective rate from tax / amount
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
                                                        <span className="ml-2 badge badge-draft" style={{ fontSize: 10, padding: '1px 4px' }}>
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
                                                                        const req = parseFloat(line.quantity || '0');
                                                                        const localInv = lineInventory.find((i: any) => i.locationId === order.fulfillmentLocationId);
                                                                        const localAvail = localInv ? parseFloat(localInv.quantityAvailable || '0') : 0;
                                                                        
                                                                        if (localAvail >= req) {
                                                                            return <span className="text-emerald-600 font-medium flex items-center gap-1">✅ {tSales('availabilityStatus.local')}</span>;
                                                                        } else if (totalAvail >= req) {
                                                                            return <span className="text-amber-600 font-medium flex items-center gap-1">🚚 {tSales('availabilityStatus.others')}</span>;
                                                                        } else {
                                                                            return <span className="text-rose-600 font-medium flex items-center gap-1">❌ {tSales('availabilityStatus.shortage')}</span>;
                                                                        }
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
                                                            {parseFloat(inv.quantityAvailable || '0') >= parseFloat(line.quantity || '0') ? '✅' : '⚠️'}
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
                                            <th>{tSales('columns.orderHash')}</th>
                                            <th>{tSales('columns.product')}</th>
                                            <th>{tSales('columns.type')}</th>
                                            <th>{tSales('columns.status')}</th>
                                            <th>{tSales('columns.date')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.backorders.map((bo: any, bo_idx: number) => {
                                            const displayOrderNumber = bo.purchaseOrderNumber || bo.orderNumber || '—';
                                            const isPo = !!bo.purchaseOrderId;
                                            const displayStatus = bo.purchaseOrderState || bo.stateCode;
                                            
                                            return (
                                                <tr 
                                                    key={bo.salesOrderId || bo.productNumber || bo_idx} 
                                                    className="cursor-pointer hover:bg-gray-50" 
                                                    onClick={() => {
                                                        if (isPo) {
                                                            router.push(`/purchase-orders/${bo.purchaseOrderId}`);
                                                        } else if (bo.salesOrderId) {
                                                            router.push(`/sales-orders/${bo.salesOrderId}`);
                                                        }
                                                    }}
                                                >
                                                    <td style={{ color: 'var(--accent)', fontWeight: 400 }}>{displayOrderNumber}</td>
                                                    <td>{bo.productNumber || '—'}</td>
                                                    <td>
                                                        {isPo ? (
                                                            <span className="badge badge-confirm">PO</span>
                                                        ) : (
                                                            bo.salesOrderId === order.parentId ? (
                                                                <span className="badge badge-confirm">{tSales('parent')}</span>
                                                            ) : (
                                                                <span className="badge badge-quoted">{tSales('child')}</span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td><StateBadge state={displayStatus as ValidState} /></td>
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

                {/* Tracking / Picking / Activity sections */}
                <PickingSection 
                    orderId={id}
                    orderState={order.stateCode}
                    orderLines={order.lines}
                    onOrderUpdated={(auto) => loadOrder(auto as any[], false)}
                    onVisibilityChange={onPickingVisibilityChange} 
                />

                {sections.invoices.show && (
                    <InvoicesSection 
                        orderId={id}
                        order={order} 
                        invoices={invoices} 
                        gstCategories={gstCategories}
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
                        gstCategories={gstCategories}
                        locations={locations}
                    />
                )}

                <div id="activity-section" className="card">
                    <ActivityTimeline events={order.events} />
                </div>
            </div>

            </DetailsLayout>

            {/* Gap/Backorder Modal */}
            {gapModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-2xl p-8 !bg-[var(--bg-card)] !rounded-2xl shadow-2xl border border-[var(--border)]">
                        <h2 className="text-[22px] font-bold mb-2 text-[var(--text-primary)]">{tSales('shortages.title')}</h2>
                        <p className="text-[14px] text-[var(--text-secondary)] mb-6">
                            {tSales('shortages.description')} <strong className="text-[var(--text-primary)]">{locations.find((l: any) => l.locationId === order.fulfillmentLocationId)?.name}</strong>:
                        </p>
                        
                        <div className="overflow-hidden border border-[var(--border)] rounded-xl mb-6 bg-white">
                            <table className="w-full text-[13px] border-collapse">
                                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{tSales('columns.product')}</th>
                                        <th className="px-4 py-3 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{tSales('columns.required')}</th>
                                        <th className="px-4 py-3 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{tSales('columns.available')}</th>
                                        <th className="px-4 py-3 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{tSales('columns.gap')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {pendingGaps.map((gap, i) => (
                                        <tr key={i} className="hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{gap.productDescription || gap.productId}</td>
                                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{gap.orderedQuantity}</td>
                                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{gap.availableQuantity}</td>
                                            <td className="px-4 py-3 text-right text-[#ef4444] font-bold">{gap.shortage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label 
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    selectedGapOption === 'backorder' 
                                        ? 'border-[var(--accent)] bg-[rgba(0,107,92,0.04)] ring-1 ring-[var(--accent)]' 
                                        : 'border-[var(--border)] bg-white hover:border-[var(--text-muted)]'
                                }`}
                                onClick={() => setSelectedGapOption('backorder')}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedGapOption === 'backorder' ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                                    }`}>
                                        {selectedGapOption === 'backorder' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-[14px] font-bold mb-1 ${selectedGapOption === 'backorder' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                                            {tSales('shortages.option1Title')}
                                        </p>
                                        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                                            {tSales('shortages.option1Desc')}
                                        </p>
                                    </div>
                                </div>
                            </label>
                            
                            <label 
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    selectedGapOption === 'ignore' 
                                        ? 'border-[var(--accent)] bg-[rgba(0,107,92,0.04)] ring-1 ring-[var(--accent)]' 
                                        : 'border-[var(--border)] bg-white hover:border-[var(--text-muted)]'
                                }`}
                                onClick={() => setSelectedGapOption('ignore')}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedGapOption === 'ignore' ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                                    }`}>
                                        {selectedGapOption === 'ignore' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-[14px] font-bold mb-1 ${selectedGapOption === 'ignore' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                                            {tSales('shortages.option2Title')}
                                        </p>
                                        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                                            {tSales('shortages.option2Desc')}
                                        </p>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-secondary px-6" onClick={() => setGapModalOpen(false)}>
                                {tCommon('cancel')}
                            </button>
                            <button 
                                className="btn btn-primary px-8" 
                                onClick={selectedGapOption === 'backorder' ? confirmWithBackorders : confirmWithoutBackorders}
                            >
                                {tCommon('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                }
                .modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                    width: 90%;
                }
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
