'use client';

import { use, useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

import PageNav from '@/components/shared/PageNav';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';

import InvoicesSection from './InvoicesSection';
import ReturnsSection from './ReturnsSection';
import FulfillmentSection from './FulfillmentSection';
import ShipmentsSection from './ShipmentsSection';
import QuoteGenerationDialog from './QuoteGenerationDialog';
import { formatLocationDisplay } from '@/lib/formatters';
import OrderDetailsCard from './OrderDetailsCard';

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
        saveHeader, changeState, calculateTaxes, archiveOrder, unarchiveOrder, copyOrder,
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
            const response = await api.reportsControllerRunHook(
                'sales-order-quote', 
                { quoteIntroText: text }, 
                { id, context: 'sales-order' }
            );
            const blob = response.data ;
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
                        onBack={() => {
                          if (window.history.length > 1) {
                            router.back();
                          } else {
                            router.push('/sales-orders');
                          }
                        }}
                        isSaving={saving}
                        badges={order.stateCode ? <StateBadge state={order.stateCode as any} /> : ''}
                        nav={<PageNav sections={visibleSections} />}
                        actions={
                            <>



                                {[...allowedTransitions]
                                    .filter(state => state !== SALES_ORDER_STATE.PICKING)
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
                                                        {/* eslint-disable-next-line i18next/no-literal-string */}
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
                    className="mb-4 px-4 py-3 rounded-lg flex items-center gap-3"
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
                    <OrderDetailsCard
                        order={order}
                        isOrderDetailsEditable={isOrderDetailsEditable}
                        editName={editName}
                        setEditName={setEditName}
                        editPO={editPO}
                        setEditPO={setEditPO}
                        editFulfillmentLocationId={editFulfillmentLocationId}
                        setEditFulfillmentLocationId={setEditFulfillmentLocationId}
                        editNotes={editNotes}
                        setEditNotes={setEditNotes}
                        saveHeader={saveHeader}
                        locations={locations}
                        copyOrder={copyOrder}
                        copying={copying}
                        onQuoteClick={() => setShowQuoteDialog(true)}
                        reportError={reportError}
                        setError={setError}
                    />

                {/* Line items / Availability tabs */}
                <div id="lines-section" className="card">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                        <div className="flex overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
                            <div className="flex gap-0 min-w-max">
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
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                            {(isOrderLinesEditable || (isOrderDetailsEditable && activeTab === 'lines' && isPostConfirmationAddingEnabled)) && (
                                <>
                                    <div className="flex-1 min-w-[200px] max-w-sm">
                                        <ProductSearchInput
                                            onSelect={addLineFromProduct}
                                            placeholder={tSales('placeholders.searchProduct')}
                                            style={{ width: '100%' }}
                                            fulfillmentLocationId={order?.fulfillmentLocationId || undefined}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-sm whitespace-nowrap"
                                        onClick={addBlankLine}
                                        disabled={saving}
                                    >
                                        + {tSales('buttons.customLine')}
                                    </button>
                                </>
                            )}
                            {!isOrderLinesEditable && isOrderDetailsEditable && activeTab === 'lines' && !isPostConfirmationAddingEnabled && (ORDER_LIFECYCLE[order?.stateCode ?? ''] >= ORDER_LIFECYCLE[SALES_ORDER_STATE.CONFIRMED]) && (
                                <button
                                    className="btn btn-secondary btn-sm whitespace-nowrap"
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
                    </div>

                    {activeTab === 'lines' ? (() => {
                        const hasActionColumn = isOrderLinesEditable || (order.lines || []).some((l: any) => l.isPostConfirmation && isOrderDetailsEditable) || isPostConfirmationAddingEnabled;

                        const lineColumns: any[] = [
                            {
                                id: 'lineNumber',
                                header: tSales('columns.lineNumber'),
                                width: 40,
                                render: (line: any) => (
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, position: 'relative' }}>
                                        {line.lineNumber}
                                    </span>
                                )
                            },
                            {
                                id: 'product',
                                header: tSales('columns.product'),
                                render: (line: any) => (
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>
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
                                    </span>
                                )
                            },
                            {
                                id: 'description',
                                header: tSales('columns.description'),
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    return (!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isEditable ? (
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
                                        <>{line.productDescription || '—'}</>
                                    );
                                }
                            },
                            {
                                id: 'qty',
                                header: tSales('columns.qty'),
                                width: 90,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    const hasGap = gapMap.has(line.salesOrderLineId);
                                    const warningIcon = hasGap ? (
                                        <>
                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                            <span 
                                                className="material-symbols-outlined" 
                                                style={{ fontSize: 14, color: 'var(--danger)', position: isEditable ? 'absolute' : 'relative', left: isEditable ? -16 : undefined, top: isEditable ? '50%' : undefined, transform: isEditable ? 'translateY(-50%)' : undefined, verticalAlign: !isEditable ? 'middle' : undefined, marginRight: !isEditable ? 4 : 0, zIndex: 1 }}
                                                title={tSales('availabilityStatus.shortage')}
                                            >
                                                warning
                                            </span>
                                            {/* eslint-enable i18next/no-literal-string */}
                                        </>
                                    ) : null;

                                    if (isEditable) {
                                        return (
                                            <div style={{ position: 'relative' }}>
                                                {warningIcon}
                                                <input
                                                    className="input"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    style={{ width: '100%', textAlign: 'right', borderColor: hasGap ? 'var(--danger)' : undefined }}
                                                    defaultValue={line.quantity}
                                                    key={`qty-${line.salesOrderLineId}-${line.quantity}`}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== line.quantity) {
                                                            updateLine(line.salesOrderLineId, 'quantity', e.target.value);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        );
                                    }
                                    return (
                                        <span style={{ fontVariantNumeric: 'tabular-nums', color: hasGap ? 'var(--danger)' : undefined, fontWeight: hasGap ? 600 : undefined }}>
                                            {warningIcon}
                                            {line.quantity}
                                        </span>
                                    );
                                }
                            },
                            {
                                id: 'uom',
                                header: tSales('columns.uom'),
                                width: 80,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    if (isEditable) {
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
                                                        const oldO = selectOptions.find((o: any) => o.uomCode === oldVal);
                                                        const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
                                                        const newO = selectOptions.find((o: any) => o.uomCode === newVal);
                                                        const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);
                                                        const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                                                        updateLineFields(line.salesOrderLineId, {
                                                            unitOfMeasure: newVal,
                                                            pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2)
                                                        });
                                                    }
                                                }}
                                            >
                                                {selectOptions.map((o: any) => (
                                                    <option key={o.uomCode} value={o.uomCode}>{o.uomCode}</option>
                                                ))}
                                            </select>
                                        );
                                    }
                                    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{line.unitOfMeasure || line.baseUom || 'EA'}</span>;
                                }
                            },
                            {
                                id: 'unitPrice',
                                header: tSales('columns.unitPrice'),
                                width: 110,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    if (isEditable) {
                                        return (
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
                                        );
                                    }
                                    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}</span>;
                                }
                            },
                            {
                                id: 'discountPct',
                                header: tSales('columns.discountPct'),
                                width: 80,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    if (isEditable) {
                                        return (
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
                                        );
                                    }
                                    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(line.discountPercentage || '0').toFixed(1)}%</span>;
                                }
                            },
                            {
                                id: 'tax',
                                header: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        {tSales('columns.tax')}
                                        {isOrderDetailsEditable && (
                                            <button
                                                type="button"
                                                onClick={calculateTaxes}
                                                disabled={saving}
                                                style={{ background: 'none', border: 'none', padding: 0, cursor: saving ? 'default' : 'pointer', color: 'var(--accent)', display: 'flex' }}
                                                title={tSales('buttons.calculateTaxes', { defaultValue: 'Calculate Taxes' })}
                                            >
                                                <span className={`material-symbols-outlined ${saving ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>sync</span>
                                            </button>
                                        )}
                                    </div>
                                ),
                                width: 110,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    const isExternalTax = !!(order as any).taxProvider && (order as any).taxProvider !== 'internal';

                                    if (isExternalTax) {
                                        const isStale = (order as any)?.customFields?.taxIsStale === true || (order as any)?.customFields?.taxIsStale === 'true';
                                        if (isStale) {
                                            return <span className="badge badge-warning" title={`Tax needs to be calculated by ${(order as any).taxProvider}`}>Pending</span>;
                                        }
                                        return <span title={`Calculated by ${(order as any).taxProvider}`} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>
                                            {formatAmount(parseFloat(line.tax || '0'), order.currencyCode || 'EUR')}
                                        </span>;
                                    }

                                    if (isEditable) {
                                        return (
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
                                        );
                                    }
                                    return (
                                        <span style={{ fontSize: 12 }}>
                                            {(() => {
                                                const c = taxCategories.find((c: TaxCategory) => c.taxCategoryId === line.taxCategoryId);
                                                if (c) {
                                                    const pct = parseFloat(c.rate || '0');
                                                    const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
                                                    return <span title={getTaxLabel(c)} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>{formattedPct}%</span>;
                                                }
                                                const amt = parseFloat(line.amount || '0');
                                                const tax = parseFloat(line.tax || '0');
                                                if (amt > 0 && tax > 0) {
                                                    const pct = (tax / amt) * 100;
                                                    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                                                }
                                                if (amt > 0 && tax === 0) return <span title={tCommon('taxLabels.exempt')} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>0%</span>;
                                                return '—';
                                            })()}
                                        </span>
                                    );
                                }
                            },
                            {
                                id: 'amount',
                                header: tSales('columns.amount'),
                                width: 110,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    return (
                                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isEditable ? 'var(--text-primary)' : undefined }}>
                                            {formatAmount(parseFloat(line.amount || '0'), order.currencyCode || 'EUR')}
                                        </span>
                                    );
                                }
                            }
                        ];

                        if (hasActionColumn) {
                            lineColumns.push({
                                id: 'actions',
                                header: '',
                                width: 50,
                                align: 'right',
                                render: (line: any) => {
                                    const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                                    if (!isEditable) return null;
                                    return (
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => removeLine(line.salesOrderLineId)}
                                            title={tSales('buttons.removeLine')}
                                        >
                                            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                                        </button>
                                    );
                                }
                            });
                        }

                        return (
                            <DataTable
                                data={order.lines}
                                keyExtractor={(line: any, idx: number) => line.salesOrderLineId || idx}
                                columns={lineColumns}
                                emptyMessage={tSales('noLineItems')}
                                mobileCard={(line: any) => {
                                    const actionCol = lineColumns.find(c => c.id === 'actions')?.render?.(line, 0);
                                    return (
                                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="font-semibold text-sm text-[var(--accent)]">
                                                    {lineColumns.find(c => c.id === 'product')?.render?.(line, 0)}
                                                </div>
                                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                                            </div>
                                            <div className="text-sm text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1">
                                                {lineColumns.find(c => c.id === 'description')?.render?.(line, 0)}
                                            </div>
                                            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                                {lineColumns.filter(c => ['qty', 'uom', 'unitPrice', 'discountPct', 'tax', 'amount'].includes(c.id!)).map(col => (
                                                    <MobileCardField 
                                                        key={col.id} 
                                                        label={col.id === 'tax' ? tSales('columns.tax') : col.header} 
                                                        value={
                                                            <div className={col.id === 'amount' ? 'font-bold text-[var(--accent)] text-base' : '[&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'}>
                                                                {col.render?.(line, 0)}
                                                            </div>
                                                        } 
                                                    />
                                                ))}
                                                {actionCol && (
                                                    <div className="flex justify-end mt-2">
                                                        {actionCol}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }}
                            footer={
                                (order.lines || []).length > 0 ? (() => {
                                    const isExternalTax = !!(order as any).taxProvider && (order as any).taxProvider !== 'internal';
                                    const isStale = isExternalTax && ((order as any)?.customFields?.taxIsStale === true || (order as any)?.customFields?.taxIsStale === 'true');
                                    const taxPct = subtotal > 0 && !isStale ? (totalTax / subtotal) * 100 : 0;
                                    return (
                                        <>
                                            <tr className="hidden lg:table-row" style={{ borderTop: '2px solid var(--border)' }}>
                                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {tCommon('subtotal')}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(subtotal, order.currencyCode || 'EUR')}
                                                </td>
                                                {(isOrderLinesEditable || (order.lines || []).some((l: any) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
                                            </tr>
                                            <tr className="hidden lg:table-row">
                                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {tCommon('tax')}{taxPct > 0 && !isStale ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>Pending</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}
                                                </td>
                                                {(isOrderLinesEditable || (order.lines || []).some((l: any) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
                                            </tr>
                                            <tr className="hidden lg:table-row" style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                                    {tCommon('total')}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>Pending</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                                                </td>
                                                {(isOrderLinesEditable || (order.lines || []).some((l: any) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
                                            </tr>
                                            {/* button moved to header */}
                                            {/* Mobile summary rows - hidden on lg, visible on mobile because the footer is wrapped in a normal div */}
                                            <tr className="lg:hidden">
                                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, order.currencyCode || 'EUR')}</td>
                                            </tr>
                                            <tr className="lg:hidden">
                                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal" style={{ display: 'inline-block' }}>Pending</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}</td>
                                            </tr>
                                            <tr className="lg:hidden">
                                                <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                                                <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal" style={{ display: 'inline-block' }}>Pending</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}</td>
                                            </tr>
                                            {/* button moved to header */}
                                        </>
                                    );
                                })() : null
                            }
                        />
                        );
                    })() : activeTab === 'availability' ? (
                        /* Availability tab */
                        inventoryLoading ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tSales('loadingInventory')}</p>
                        ) : (
                            <DataTable
                                data={order.lines}
                                keyExtractor={(line: any, idx: number) => line.salesOrderLineId || idx}
                                columns={[
                                    { header: tSales('columns.lineNumber'), width: 40 },
                                    { header: tSales('columns.product') },
                                    { header: tSales('columns.description') },
                                    { header: tSales('columns.ordered'), width: 90, align: 'right' },
                                    { header: tSales('columns.fulfillment'), width: 140, align: 'left' },
                                    { header: tSales('columns.location'), width: 100, align: 'right' },
                                    { header: tSales('columns.onHand'), width: 90, align: 'right' },
                                    { header: tSales('columns.committed'), width: 90, align: 'right' },
                                    { header: tSales('columns.incoming'), width: 90, align: 'right' },
                                    { header: tSales('columns.available'), width: 90, align: 'right' },
                                    { header: tSales('columns.status'), width: 70, align: 'center' }
                                ]}
                                renderCustomRow={(line: any, idx: number) => {
                                    const lineInventory = inventoryData.filter(
                                        (inv: any) => inv.productId === line.productId && line.productId !== '00000000-0000-0000-0000-000000000000',
                                    );
                                    const totalAvail = lineInventory.reduce(
                                        (sum: number, inv: any) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                                    );
                                    const gap = gapMap.get(line.salesOrderLineId);
                                    const canFulfil = !gap;

                                    const isCustom = !line.productId || line.productId === '00000000-0000-0000-0000-000000000000';
                                    if (line.productType === 'non-stock' || line.productType === 'service' || line.productType === 'freight' || isCustom) {
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
                                }}
                                mobileCard={(line: any) => {
                                    const lineInventory = inventoryData.filter(
                                        (inv: any) => inv.productId === line.productId && line.productId !== '00000000-0000-0000-0000-000000000000',
                                    );
                                    const totalAvail = lineInventory.reduce(
                                        (sum: number, inv: any) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                                    );
                                    const gap = gapMap.get(line.salesOrderLineId);
                                    const canFulfil = !gap;
                                    const isCustom = !line.productId || line.productId === '00000000-0000-0000-0000-000000000000';

                                    return (
                                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="font-semibold text-sm text-[var(--accent)]">
                                                    {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                                </div>
                                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                                            </div>
                                            <div className="text-sm text-slate-600 font-medium mb-3">
                                                {line.productDescription} {isCustom && <span className="badge badge-sm badge-draft ml-2">{line.productType || 'custom'}</span>}
                                            </div>
                                            
                                            {isCustom || line.productType === 'non-stock' || line.productType === 'service' || line.productType === 'freight' ? (
                                                <div className="text-sm text-slate-500 italic text-center py-2 bg-slate-50 rounded border border-slate-100">{tSales('virtualFulfillmentBypass')} ✅</div>
                                            ) : lineInventory.length === 0 ? (
                                                <div className="text-sm text-rose-500 italic text-center py-2 bg-rose-50 rounded border border-rose-100">{tSales('noInventoryFound')} ❌</div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-center py-2 border-t border-slate-100">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.ordered')}</span>
                                                        <span className="text-sm font-semibold">{line.quantity}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.fulfillment')}</span>
                                                        <span className="text-sm font-medium">
                                                            {canFulfil ? <span className="text-emerald-600">✅ {tSales('availabilityStatus.local')}</span> :
                                                             gap && totalAvail >= gap.orderedQuantity ? <span className="text-amber-600">🚚 {tSales('availabilityStatus.others')}</span> :
                                                             <span className="text-rose-600">❌ {tSales('availabilityStatus.shortage')}</span>}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="mt-3 flex flex-col gap-2">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.location')}:</span>
                                                        {lineInventory.map((inv: any) => (
                                                            <div key={inv.locationId} className="bg-slate-50 rounded p-2 text-xs flex flex-col gap-1 border border-slate-100">
                                                                <div className="flex justify-between font-medium">
                                                                    <span className={inv.locationId === order.fulfillmentLocationId ? 'text-[var(--accent)]' : ''}>{inv.locationName}</span>
                                                                    <span className={parseFloat(inv.quantityAvailable) >= line.quantity ? 'text-emerald-600' : 'text-rose-600'}>{parseFloat(inv.quantityAvailable)} avail</span>
                                                                </div>
                                                                <div className="flex justify-between text-slate-500">
                                                                    <span>{parseFloat(inv.quantityOnHand)} on hand</span>
                                                                    <span>{parseFloat(inv.quantityCommitted)} cmt / {parseFloat(inv.quantityOnOrder)} in</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                }}
                            />
                        )
                    ) : (
                        /* Backorders tab */
                        <div>
                            <DataTable
                                data={order.backorders || []}
                                keyExtractor={(bo: any, idx: number) => bo.salesOrderLineId || bo.purchaseOrderId || idx}
                                emptyMessage={tSales('noBackordersFound')}
                                columns={[
                                    { header: tSales('columns.lineNumber') },
                                    { header: tSales('columns.product') },
                                    { header: tSales('columns.allocatedTo') },
                                    { header: tSales('columns.status') },
                                    { header: tSales('columns.demandDate') },
                                ]}
                                renderCustomRow={(bo: any, bo_idx: number) => {
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
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tSales('demandedQty', { qty: bo.quantity })}</div>
                                            </td>
                                            <td style={{ color: isPo ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 400 }}>{displayOrderNumber}</td>
                                            <td>
                                                {isPo ? (
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className="badge badge-sm badge-success">{tSales('allocated')}</span>
                                                        <StateBadge state={bo.purchaseOrderState as ValidState} />
                                                    </div>
                                                ) : (
                                                    <span className="badge badge-draft">{tSales('openDemandBadge')}</span>
                                                )}
                                            </td>
                                            <td>{new Date(bo.createdOn).toLocaleDateString()}</td>
                                        </tr>
                                    );
                                }}
                                mobileCard={(bo: any) => {
                                    const isPo = !!bo.purchaseOrderId;
                                    const displayOrderNumber = isPo ? bo.purchaseOrderNumber || '—' : '—';
                                    
                                    return (
                                        <div 
                                            className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col ${isPo ? 'cursor-pointer active:bg-gray-50' : ''}`}
                                            onClick={() => {
                                                if (isPo) {
                                                    router.push(`/purchase-orders/${bo.purchaseOrderId}`);
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="font-semibold text-sm text-[var(--text-primary)]">
                                                    {bo.productNumber || '—'}
                                                </div>
                                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{bo.lineNumber || '—'}</div>
                                            </div>
                                            
                                            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1 mt-2">
                                                <MobileCardField label={tSales('columns.allocatedTo')} value={
                                                    <span className={isPo ? 'text-[var(--accent)]' : 'text-slate-400'}>{displayOrderNumber}</span>
                                                } />
                                                <MobileCardField label={tSales('columns.demandDate')} value={
                                                    new Date(bo.createdOn).toLocaleDateString()
                                                } />
                                                <MobileCardField label={tSales('demandedQty', { qty: bo.quantity })} value={
                                                    isPo ? (
                                                        <div className="flex flex-col gap-1 items-end mt-1">
                                                            <span className="badge badge-sm badge-success">{tSales('allocated')}</span>
                                                            <StateBadge state={bo.purchaseOrderState as ValidState} />
                                                        </div>
                                                    ) : (
                                                        <span className="badge badge-draft mt-1">{tSales('openDemandBadge')}</span>
                                                    )
                                                } />
                                            </div>
                                        </div>
                                    );
                                }}
                            />
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
                                {/* eslint-disable-next-line i18next/no-literal-string */}
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
