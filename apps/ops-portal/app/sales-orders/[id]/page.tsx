'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

import type { GstCategory } from './types';
import { getGstLabel } from './types';
import { useOrder } from './useOrder';

import {
    RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
    SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
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



export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        order, error, setError, saving, copying,
        editName, setEditName, editPO, setEditPO, editNotes, setEditNotes, headerDirty,
        gstCategories,
        activeTab, setActiveTab, inventoryData, inventoryLoading,
        returns, returnsLoading, showCreateReturn, setShowCreateReturn,
        invoices, pickingSummary,
        isOrderDetailsEditable, isOrderLinesEditable,
        allowedTransitions, subtotal, totalTax,
        saveHeader, changeState, archiveOrder, unarchiveOrder, copyOrder,
        updateLine, removeLine, addLineFromProduct, addBlankLine,
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
    const PICKING_INVOICE_STATES = ['picking', 'shipped', 'invoiced', 'legacy'];
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
                                                {state === 'cancelled' ? <>✕ <StateName state={state as ValidState} /></> : back ? <>← <StateName state={state as ValidState} /></> : <>→ <StateName state={state as ValidState} /></>}
                                            </button>
                                        );
                                    })}
                            </>
                        }
                    />
                }
            >

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
                    <button className="ml-3 text-xs underline" onClick={() => setError('')}>{tCommon('dismiss')}</button>
                </div>
            )}

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
                    <div id="details-section" className="card col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="section-heading !mb-0">
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
                                    {new Date(order.createdOn).toLocaleString()} by {order.createdBy || '—'}
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
                                Backorders
                            </button>
                        </div>
                        {isOrderLinesEditable && activeTab === 'lines' && (
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
                    </div>

                    {activeTab === 'lines' ? (
                        <table className="table-lines">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>{tSales('columns.lineNumber')}</th>
                                    <th>{tSales('columns.product')}</th>
                                    <th>{tSales('columns.description')}</th>
                                    <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.qty')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.unitPrice')}</th>
                                    <th style={{ width: 80, textAlign: 'right' }}>{tSales('columns.discountPct')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.gst')}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{tSales('columns.amount')}</th>
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
                                        <td>
                                            {(!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isOrderLinesEditable ? (
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
                                                    {parseFloat(line.discountPercentage || '0').toFixed(1)}%
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
                                                            {getGstLabel(c)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        ) : (
                                            <td style={{ textAlign: 'right', fontSize: 12 }}>
                                                {(() => {
                                                    const c = gstCategories.find((c) => c.gstCategoryId === line.gstCategoryId);
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
                                        {isOrderLinesEditable && (
                                            <td>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => removeLine(line.salesOrderLineId)}
                                                    title={tSales('buttons.removeLine')}
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
                                            {tSales('noLineItems')}
                                        </td>
                                    </tr>
                                )}
                                {order.lines.length > 0 && (() => {
                                    const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                                    return (
                                        <>
                                            <tr style={{ borderTop: '2px solid var(--border)' }}>
                                                <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {tCommon('subtotal')}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(subtotal, order.currencyCode || 'EUR')}
                                                </td>
                                                {isOrderLinesEditable && <td></td>}
                                            </tr>
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(totalTax, order.currencyCode || 'EUR')}
                                                </td>
                                                {isOrderLinesEditable && <td></td>}
                                            </tr>
                                            <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                                                <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
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
                                        <th style={{ width: 140, textAlign: 'left' }}>Fulfillment</th>
                                        <th style={{ width: 100, textAlign: 'right' }}>{tSales('columns.location')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.onHand')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.committed')}</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>Incoming</th>
                                        <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.available')}</th>
                                        <th style={{ width: 70, textAlign: 'center' }}>{tSales('columns.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.lines.filter(l => l.productId !== '00000000-0000-0000-0000-000000000000').map((line) => {
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
                                                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                                    </td>
                                                    <td>{line.productDescription || '—'}</td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                                                    <td style={{ padding: '4px' }}>
                                                        <select
                                                            value={line.fulfillmentLocationId || ''}
                                                            onChange={(e) => updateLine(line.salesOrderLineId, { fulfillmentLocationId: e.target.value })}
                                                            className="form-control"
                                                            style={{ width: '100%', fontSize: 12, padding: '2px 6px' }}
                                                            disabled={!isOrderLinesEditable}
                                                        >
                                                            <option value="" disabled>Select...</option>
                                                            {locations.map((loc) => (
                                                                <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                                        {tSales('noInventoryData')}
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
                                                                {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                                            </td>
                                                            <td rowSpan={lineInventory.length}>{line.productDescription || '—'}</td>
                                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} rowSpan={lineInventory.length}>
                                                                {line.quantity}
                                                            </td>
                                                            <td rowSpan={lineInventory.length} style={{ padding: '4px' }}>
                                                                <select
                                                                    value={line.fulfillmentLocationId || ''}
                                                                    onChange={(e) => updateLine(line.salesOrderLineId, { fulfillmentLocationId: e.target.value })}
                                                                    className="form-control"
                                                                    style={{ width: '100%', fontSize: 12, padding: '2px 6px' }}
                                                                    disabled={!isOrderLinesEditable}
                                                                >
                                                                    <option value="" disabled>Select...</option>
                                                                    {locations.map((loc) => (
                                                                        <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                                                                    ))}
                                                                </select>
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
                                                        {parseFloat(inv.quantityOnOrder || '0')}
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
                                                {tSales('noLineItemsShort')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* Backorders tab */
                        <table className="table-lines">
                            <thead>
                                <tr>
                                    <th>{tSales('columns.product')}</th>
                                    <th style={{ width: 120, textAlign: 'right' }}>Missing Qty</th>
                                    <th>Status</th>
                                    <th>PO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!order.backorders || order.backorders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                                            No backorders recorded for this sales order.
                                        </td>
                                    </tr>
                                ) : (
                                    order.backorders.map((bo: any) => (
                                        <tr key={bo.productId}>
                                            <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                                                {bo.productNumber || bo.productId?.substring(0, 8) || '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                {bo.quantity}
                                            </td>
                                            <td>
                                                <span className={`badge ${bo.stateCode === 'pending_supply' ? 'badge-draft' : 'badge-confirmed'}`}>
                                                    {bo.stateCode === 'pending_supply' ? 'Pending Supply' : bo.stateCode === 'awaiting_receipt' ? 'Awaiting' : bo.stateCode}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13 }}>
                                                {bo.purchaseOrderId ? (
                                                    <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--text-main)' }} onClick={() => router.push(`/purchase-orders/${bo.purchaseOrderId}`)}>
                                                        {bo.purchaseOrderNumber || bo.purchaseOrderId.substring(0, 8)}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Picking section */}
                {order.stateCode !== 'legacy' && (
                    <div id="picking-section">
                    <PickingSection
                        orderId={order.salesOrderId || id}
                        orderState={order.stateCode}
                        orderLines={order.lines}
                        onOrderUpdated={(autoTransitions?: any[]) => loadOrder(autoTransitions, false)}
                        onVisibilityChange={onPickingVisibilityChange}
                        fulfillmentLocationId={order.fulfillmentLocationId}
                    />
                    </div>
                )}

                {/* Invoices section */}
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

                {/* Returns section */}
                {sections.returns.show && (
                    <div id="returns-section">
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
                    />
                    </div>
                )}


                {/* Audit timeline — only for app orders */}
                {sections.activity.show && (
                    <div id="activity-section" className="card">
                        <ActivityTimeline events={order.events || []} />
                    </div>
                )}

                {/* Archive / Unarchive — bottom right */}
                {(order.stateCode === 'invoiced' || order.stateCode === 'cancelled') && (
                    <div className="flex justify-end mt-4">
                        <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={archiveOrder}
                            disabled={saving}
                        >
                            {tSales('buttons.archive')}
                        </button>
                    </div>
                )}
                {order.stateCode === 'archived' && (
                    <div className="flex justify-end mt-4">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={unarchiveOrder}
                            disabled={saving}
                        >
                            {tSales('buttons.unarchive')}
                        </button>
                    </div>
                )}
            </div>
            </DetailsLayout>

            {/* Gap Generation Modal */}
            {gapModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 pt-10">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                {/* eslint-disable-next-line i18next/no-literal-string */}
                                <span className="material-symbols-outlined">inventory_2</span>
                                {/* eslint-disable-next-line i18next/no-literal-string */}
                                Inventory Shortage Detected
                            </h3>
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <button className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setGapModalOpen(false)}>✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                                The following items are short in stock to fulfill this order:
                            </p>
                            
                            <table className="table-lines w-full mb-4">
                                <thead>
                                    <tr>
                                        {/* eslint-disable-next-line i18next/no-literal-string */}
                                        <th>Product</th>
                                        {/* eslint-disable-next-line i18next/no-literal-string */}
                                        <th style={{ textAlign: 'right' }}>Missing Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingGaps.map((g, i) => {
                                        const line = order.lines.find(l => l.salesOrderLineId === g.salesOrderLineId);
                                        return (
                                            <tr key={i}>
                                                <td className="font-medium text-sm">
                                                    {line?.productNumber || line?.productDescription || g.productId.substring(0,8)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                                    {g.shortage}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 mt-4">
                                {/* eslint-disable-next-line i18next/no-literal-string */}
                                <span className="material-symbols-outlined text-blue-500">info</span>
                                <div className="text-sm text-blue-800 dark:text-blue-300">
                                    {/* eslint-disable-next-line i18next/no-literal-string */}
                                    <p>
                                        Backordering will commit the open quantity for reserving, and create draft POs to fill the reservations.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-end gap-3 bg-gray-50 dark:bg-zinc-800/50">
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <button className="btn btn-secondary" disabled={saving} onClick={confirmWithoutBackorders}>
                                Proceed Without Backorders
                            </button>
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <button className="btn btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600" disabled={saving} onClick={confirmWithBackorders}>
                                Generate Backorders
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}