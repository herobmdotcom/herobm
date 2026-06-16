'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import MasterDetailLayout from '@/components/shared/MasterDetailLayout';

import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { SALES_ORDER_PICK_STATE } from '@herobm/shared';
import { getErrorMessage } from '@herobm/shared';

interface UnifiedOrder {
    id: string;
    orderNumber: string;
    name: string;
    customerName: string;
    customerOrderNumber: string;
    stateCode: string;
    createdBy: string;
    createdOn: string | null;
    totalPrice: string | null;
    currencyCode: string | null;
    pickabilityStatus: 'ready' | 'partial' | 'blocked';
    hasAllocation?: boolean;
    type?: 'sales_order' | 'transfer_order';
}

interface PickAllocation {
    pickId: string;
    salesOrderId: string;
    salesOrderLineId: string;
    productId: string;
    binId: string;
    quantity: string;
    stateCode: string;
    binName?: string;
    line?: PickingLine;
}

interface PickingLine {
    salesOrderLineId: string;
    lineNumber: number;
    productId: string;
    productNumber: string;
    productType: string;
    productDescription: string;
    locationName: string;
    availableBins: { binId: string; binName: string; onHand: string }[];
    quantity: string;
    quantityPicked: string;
    quantityShipped: string;
    remaining: string;
    isFullyPicked: boolean;
    isPhysical: boolean;
    onHand: string;
    hasAllocation?: boolean;
}

interface PickingSummary {
    totalLines: number;
    fullyPickedLines: number;
    isFullyPicked: boolean;
    lines: PickingLine[];
    picks: PickAllocation[];
}

export default function PickingPage() {
    const t = useTranslations('picking');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const { app } = useSettings();

    const [locations, setLocations] = useState<{ locationId: string; code: string; name: string }[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [pendingOrders, setPendingOrders] = useState<UnifiedOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [activeTab, setActiveTab] = useState<'ready' | 'partial' | 'blocked'>('ready');
    
    // Picking Context
    const [pickingSummary, setPickingSummary] = useState<PickingSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    
    // Action State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickInputs, setPickInputs] = useState<Record<string, { quantity: string, binId: string }>>({});

    // Fetch Locations
    useEffect(() => {
        api.inventoryControllerFindAllLocations().then((response) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                const res = response.data as any;
                const locs = Array.isArray(res) ? res : (res.data || []);
                setLocations(locs);
                if (locs.length > 0) {
                    const defaultLocId = app?.defaultFulfillmentLocationId || locs[0].locationId;
                    setSelectedLocationId(defaultLocId);
                }
            })
            .catch(err => reportError(err, 'Failed to load locations'));
    }, [app?.defaultFulfillmentLocationId]);

    // Fetch Pending Orders
    const loadOrders = useCallback(() => {
        setLoadingOrders(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
        const params: any = {};
        if (selectedLocationId) params.locationId = selectedLocationId;

        api.orderPickingControllerGetPickingQueue(params)
            .then(data => {
                setPendingOrders(data.data as unknown as UnifiedOrder[]);
            })
            .catch(err => reportError(err, 'Failed to load pending orders'))
            .finally(() => setLoadingOrders(false));
    }, [selectedLocationId]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(() => {
        const filtered = pendingOrders.filter(o => o.pickabilityStatus === activeTab);
        // Allocated orders sort first
        filtered.sort((a, b) => {
            if (a.hasAllocation !== b.hasAllocation) return a.hasAllocation ? -1 : 1;
            return 0;
        });
        return filtered;
    }, [pendingOrders, activeTab]);

    // Fetch Summary for Selected Order
    const loadSummary = useCallback(() => {
        if (!selectedOrder) {
            setPickingSummary(null);
            return;
        }

        setLoadingSummary(true);
        setError(null);
        
        const summaryPromise = selectedOrder.type === 'transfer_order' 
            ? api.transfersControllerGetPickingSummary(selectedOrder.id) 
            : api.orderPickingControllerGetPickingSummary(selectedOrder.id);
            
        summaryPromise
            .then((res) => {
                const data = res.data;
                setPickingSummary(data as unknown as PickingSummary);
                
                // Initialize default quantities (what's remaining and fits in a bin)
                const defaultInputs: Record<string, { quantity: string, binId: string }> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                ((data as any).lines || []).forEach((line: PickingLine) => {
                    if (line.isPhysical && !line.isFullyPicked && parseFloat(line.remaining) > 0) {
                        const bestBin = line.availableBins[0];
                        if (bestBin) {
                            const remaining = parseFloat(line.remaining);
                            const onHand = parseFloat(bestBin.onHand);
                            const take = Math.min(remaining, onHand);
                            if (take > 0) {
                                defaultInputs[line.salesOrderLineId] = {
                                    quantity: String(take),
                                    binId: bestBin.binId
                                };
                            }
                        }
                    }
                });
                setPickInputs(defaultInputs);
            })
            .catch(err => setError(getErrorMessage(err)))
            .finally(() => setLoadingSummary(false));
    }, [selectedOrder]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    const handlePickLine = async (lineId: string) => {
        if (!selectedOrder) return;
        
        const input = pickInputs[lineId];
        if (!input || !input.quantity || !input.binId) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (selectedOrder.type === 'transfer_order') {
                await api.transfersControllerPickLine(selectedOrder.id, lineId, { quantity: input.quantity, binId: input.binId });
            } else {
                await api.orderPickingControllerPickLine(selectedOrder.id, lineId, { quantity: input.quantity, binId: input.binId });
            }
            await loadSummary();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelPick = async (pickId: string) => {
        if (!selectedOrder) return;
        setIsSubmitting(true);
        setError(null);
        try {
            if (selectedOrder.type === 'transfer_order') {
                await api.transfersControllerCancelPick(selectedOrder.id, pickId);
            } else {
                await api.orderPickingControllerCancelPick(selectedOrder.id, pickId);
            }
            await loadSummary();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintDocket = async () => {
        if (!selectedOrder) return;
        setIsGeneratingPdf(true);
        try {
            const response = await api.pdfTemplatesControllerRunHook('picking-slip', { shipmentId: selectedOrder.id }, { id: selectedOrder.id, context: 'picking-slip' });
            const blob = response.data as Blob;
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err: unknown) {
            alert('Failed to generate PDF: ' + getErrorMessage(err));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const { itemsToPick, unavailableItems, pickedItems, shippedItems } = useMemo(() => {
        if (!pickingSummary) return { itemsToPick: [], unavailableItems: [], pickedItems: [], shippedItems: [] };
        
        const toPick = pickingSummary.lines.filter(l => parseFloat(l.remaining) > 0 && parseFloat(l.onHand) > 0 && l.isPhysical);
        const unavailable = pickingSummary.lines.filter(l => parseFloat(l.remaining) > 0 && parseFloat(l.onHand) <= 0 && l.isPhysical);
        
        const picked = pickingSummary.picks.filter(p => p.stateCode === SALES_ORDER_PICK_STATE.PICKED).map(p => {
            const line = pickingSummary.lines.find(l => l.salesOrderLineId === p.salesOrderLineId);
            return { ...p, line };
        });
        
        const shipped = pickingSummary.picks.filter(p => p.stateCode === SALES_ORDER_PICK_STATE.SHIPPED).map(p => {
            const line = pickingSummary.lines.find(l => l.salesOrderLineId === p.salesOrderLineId);
            return { ...p, line };
        });

        return { itemsToPick: toPick, unavailableItems: unavailable, pickedItems: picked, shippedItems: shipped };
    }, [pickingSummary]);

    return (
        <MasterDetailLayout
            title={t('title')}
            controls={
                <>
                    <span className="text-sm font-semibold text-[var(--text-muted)] hidden sm:inline">{t('locationLabel')}</span>
                    <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="input text-sm w-full sm:w-48"
                    >
                        {locations.map(loc => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {loc.code} - {loc.name}
                            </option>
                        ))}
                    </select>
                </>
            }
            masterWidthClass="lg:w-[350px] lg:shrink-0"
            isDetailOpen={!!selectedOrder}
            onCloseDetail={() => setSelectedOrder(null)}
            detailTitle={selectedOrder ? selectedOrder.orderNumber : t('title')}
            masterPane={
                <>
                    <div className="flex lg:border-b lg:border-[var(--border)] lg:bg-[var(--bg-secondary)] text-xs font-bold pt-1 lg:px-1 gap-1 border-b border-[var(--border)]">
                        <button 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'ready' ? 'border-[var(--success)] text-[var(--success)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('ready')}
                        >
                            {t('tabs.ready')} <span className="ml-1 opacity-75 font-normal">({pendingOrders.filter(o => o.pickabilityStatus === 'ready').length})</span>
                        </button>
                        <button 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'partial' ? 'border-[var(--warning)] text-[var(--warning)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('partial')}
                        >
                            {t('tabs.partial')} <span className="ml-1 opacity-75 font-normal">({pendingOrders.filter(o => o.pickabilityStatus === 'partial').length})</span>
                        </button>
                        <button 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'blocked' ? 'border-[var(--danger)] text-[var(--danger)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('blocked')}
                        >
                            {t('tabs.blocked')} <span className="ml-1 opacity-75 font-normal">({pendingOrders.filter(o => o.pickabilityStatus === 'blocked').length})</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 bg-[var(--bg-card)] lg:bg-transparent rounded-b-md lg:rounded-none">
                        {loadingOrders ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                { }
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                {t('noOrders', { tab: activeTab })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredOrders.map(order => (
                                    <div 
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-[var(--bg-secondary-hover)] border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                {order.hasAllocation ? (
                                                    /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                                                    <span className={`material-symbols-outlined indicator-icon shrink-0 ${order.pickabilityStatus === 'ready' ? 'text-[var(--success)]' : order.pickabilityStatus === 'partial' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`} title={t('tooltips.allocated')} style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                                                ) : (
                                                     
                                                    <span className={`material-symbols-outlined indicator-icon shrink-0 ${order.pickabilityStatus === 'ready' ? 'text-[var(--success)]' : order.pickabilityStatus === 'partial' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`} style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span>
                                                )}
                                                <div className="font-bold text-[var(--text-primary)] text-sm">{order.orderNumber}</div>
                                            </div>
                                            <StateBadge state={order.stateCode as ValidState} />
                                        </div>
                                        <div className="text-xs font-bold text-[var(--text-secondary)] mb-1 pl-7">{order.customerName}</div>
                                        <div className="text-xs text-[var(--text-muted)] truncate pl-7">{order.name || order.customerOrderNumber}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            }
            detailPane={
                (() => {
                    const actionFormContent = (
                        <>
                            {!selectedOrder ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">pallet</span>
                            {t('selectOrder')}
                        </div>
                    ) : loadingSummary ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                            {t('loadingOrder')}
                        </div>
                    ) : pickingSummary ? (
                        <>
                            {/* Card Header with Order Info */}
                            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
                                <h2 className="text-sm text-[var(--text-primary)] uppercase tracking-wider truncate mr-4 flex items-center gap-4">
                                    <span className="font-bold shrink-0">{selectedOrder.orderNumber}</span>
                                    <span className="text-[var(--text-muted)] opacity-50 hidden sm:inline">&middot;</span>
                                    <span className="truncate hidden sm:inline">{selectedOrder.name || t('noName')}</span>
                                    <span className="text-[var(--text-muted)] opacity-50 hidden sm:inline">&middot;</span>
                                    <span className="truncate hidden sm:inline">{selectedOrder.customerName}</span>
                                </h2>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button 
                                        onClick={handlePrintDocket} 
                                        disabled={isGeneratingPdf}
                                        className="btn btn-secondary btn-sm flex items-center gap-1.5"
                                    >
                                        {isGeneratingPdf && (
                                            /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                                            <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                                        )}
                                        <span className="hidden sm:inline">{t('pickingSlipPdf')}</span>
                                        { }
                                        <span className="sm:hidden material-symbols-outlined text-[16px]">print</span>
                                    </button>
                                    <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pickingSummary.fullyPickedLines} / {pickingSummary.totalLines}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex flex-col h-full w-full">
                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
                                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            {error}
                                        </div>
                                    )}

                                <div className="space-y-8">
                                    {/* To Pick Table */}
                                    <div>
                                        <h4 className="section-heading !mb-4">{t('toPick')}</h4>
                                        <table className="table-lines hidden lg:table">
                                            <thead>
                                                <tr>
                                                    <th>{t('columns.product')}</th>
                                                    <th>{t('columns.binLocation')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('columns.ordered')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('columns.remaining')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('columns.onHand')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('columns.pickQty')}</th>
                                                    <th>{t('columns.action')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itemsToPick.map((line, idx) => (
                                                    <tr key={`${line.salesOrderLineId}-${idx}`}>
                                                        <td>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="font-bold">{line.productNumber}</div>
                                                                {line.hasAllocation && (
                                                                    <>
                                                                        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                                                        <span className="material-symbols-outlined indicator-icon text-[var(--accent)]" title={t('tooltips.stockSpecificallyOrdered')} style={{ fontVariationSettings: "'FILL' 1" }}>
                                                                            bookmark
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{line.productDescription}</div>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="input text-sm py-1 px-2 w-48"
                                                                value={pickInputs[line.salesOrderLineId]?.binId || ''}
                                                                onChange={e => setPickInputs(prev => ({
                                                                    ...prev,
                                                                    [line.salesOrderLineId]: {
                                                                        ...prev[line.salesOrderLineId],
                                                                        binId: e.target.value
                                                                    }
                                                                }))}
                                                            >
                                                                <option value="" disabled>{t('selectBin')}</option>
                                                                {line.availableBins.map(b => (
                                                                    <option key={b.binId} value={b.binId}>{b.binName} {t('qtyOption', { qty: parseFloat(b.onHand) })}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div>{parseFloat(line.quantity).toLocaleString()}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div>{parseFloat(line.remaining).toLocaleString()}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div>
                                                                {parseFloat(line.onHand).toLocaleString()}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div className="flex justify-end">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    max={Math.min(parseFloat(line.remaining), parseFloat(line.onHand))}
                                                                    value={pickInputs[line.salesOrderLineId]?.quantity || ''}
                                                                    onChange={(e) => setPickInputs(prev => ({
                                                                        ...prev,
                                                                        [line.salesOrderLineId]: {
                                                                            ...prev[line.salesOrderLineId],
                                                                            quantity: e.target.value
                                                                        }
                                                                    }))}
                                                                    className="input"
                                                                    style={{ width: '80px', textAlign: 'right', padding: '2px 6px', fontSize: '13px' }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePickLine(line.salesOrderLineId)}
                                                                disabled={isSubmitting || !pickInputs[line.salesOrderLineId]?.quantity || !pickInputs[line.salesOrderLineId]?.binId}
                                                                className="btn btn-primary btn-sm"
                                                            >
                                                                {t('buttons.pick')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {itemsToPick.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="py-6 text-center text-sm text-[var(--text-muted)]">
                                                            {t('noItemsToPick')}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        <div className="flex flex-col gap-3 lg:hidden">
                                            {itemsToPick.map((line, idx) => (
                                                <div key={`mobile-topick-${line.salesOrderLineId}-${idx}`} className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{line.productNumber}</div>
                                                                {line.hasAllocation && (
                                                                    /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                                                                    <span className="material-symbols-outlined indicator-icon text-[var(--accent)] text-sm shrink-0" title={t('tooltips.stockSpecificallyOrdered')} style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-[var(--text-muted)] truncate">{line.productDescription}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-2 mb-3 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.ordered')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.quantity).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.remaining')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.remaining).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.onHand')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.onHand).toLocaleString()}</div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-xs font-bold w-16 text-[var(--text-muted)]">{t('columns.binLocation')}</div>
                                                            <select
                                                                className="input text-sm flex-1 py-1"
                                                                value={pickInputs[line.salesOrderLineId]?.binId || ''}
                                                                onChange={e => setPickInputs(prev => ({ ...prev, [line.salesOrderLineId]: { ...prev[line.salesOrderLineId], binId: e.target.value } }))}
                                                            >
                                                                <option value="" disabled>{t('selectBin')}</option>
                                                                {line.availableBins.map(b => (
                                                                    <option key={b.binId} value={b.binId}>{b.binName} {t('qtyOption', { qty: parseFloat(b.onHand) })}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-xs font-bold w-16 text-[var(--text-muted)]">{t('columns.pickQty')}</div>
                                                                <input
                                                                    type="number" min="0.01" step="0.01"
                                                                    max={Math.min(parseFloat(line.remaining), parseFloat(line.onHand))}
                                                                    value={pickInputs[line.salesOrderLineId]?.quantity || ''}
                                                                    onChange={(e) => setPickInputs(prev => ({ ...prev, [line.salesOrderLineId]: { ...prev[line.salesOrderLineId], quantity: e.target.value } }))}
                                                                    className="input flex-1 py-1 px-2 text-right"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePickLine(line.salesOrderLineId)}
                                                                disabled={isSubmitting || !pickInputs[line.salesOrderLineId]?.quantity || !pickInputs[line.salesOrderLineId]?.binId}
                                                                className="btn btn-primary w-full justify-center mt-2"
                                                            >
                                                                {t('buttons.pick')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {itemsToPick.length === 0 && (
                                                <div className="p-4 text-center text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">
                                                    {t('noItemsToPick')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Unavailable Table */}
                                    {unavailableItems.length > 0 && (
                                        <div>
                                            <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('unavailable')}</h4>
                                            <table className="table-lines opacity-70 hidden lg:table">
                                                <thead>
                                                    <tr>
                                                        <th>{t('columns.product')}</th>
                                                        <th>{t('columns.binLocation')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.ordered')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.remaining')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.onHand')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.pickQty')}</th>
                                                        <th>{t('columns.action')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {unavailableItems.map((line, idx) => (
                                                        <tr key={`${line.salesOrderLineId}-${idx}`}>
                                                            <td>
                                                                <div className="font-bold">{line.productNumber}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{line.productDescription}</div>
                                                            </td>
                                                            <td className="text-[var(--text-muted)]">-</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div>{parseFloat(line.quantity).toLocaleString()}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="text-[var(--text-muted)]">{parseFloat(line.remaining).toLocaleString()}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="text-[var(--danger)]">
                                                                    {parseFloat(line.onHand).toLocaleString()}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">-</td>
                                                            <td>
                                                                <span className="text-xs italic text-[var(--text-muted)]">{t('outOfStock')}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="flex flex-col gap-3 lg:hidden opacity-70">
                                                {unavailableItems.map((line, idx) => (
                                                    <div key={`mobile-unavail-${line.salesOrderLineId}-${idx}`} className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{line.productNumber}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate">{line.productDescription}</div>
                                                            </div>
                                                            <span className="text-xs italic text-[var(--text-muted)] shrink-0">{t('outOfStock')}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.ordered')}</div>
                                                                <div className="text-xs font-medium">{parseFloat(line.quantity).toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.remaining')}</div>
                                                                <div className="text-xs font-medium text-[var(--text-muted)]">{parseFloat(line.remaining).toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.onHand')}</div>
                                                                <div className="text-xs font-medium text-[var(--danger)]">{parseFloat(line.onHand).toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Picked Table */}
                                    {pickedItems.length > 0 && (
                                        <div>
                                            <h4 className="section-heading !mb-4">{t('picked')}</h4>
                                            <table className="table-lines hidden lg:table">
                                                <thead>
                                                    <tr>
                                                        <th>{t('columns.product')}</th>
                                                        <th>{t('columns.binLocation')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.ordered')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.remaining')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.onHand')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.pickQty')}</th>
                                                        <th>{t('columns.action')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pickedItems.map(pick => (
                                                        <tr key={pick.pickId}>
                                                            <td>
                                                                <div className="font-bold">{pick.line?.productNumber || tCommon('unknown')}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{pick.line?.productDescription || ''}</div>
                                                            </td>
                                                            <td className="text-[var(--text-muted)]">{pick.binName || '-'}</td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.quantity).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.remaining).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.onHand).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="flex justify-end items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                                                                    {pick.line && !pick.line.isFullyPicked && (
                                                                        <>
                                                                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                                                            <span className="material-symbols-outlined text-[16px] text-[var(--warning)]" title={t('tooltips.partiallyPicked')}>
                                                                                warning
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {parseFloat(pick.quantity).toLocaleString()}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCancelPick(pick.pickId)}
                                                                        disabled={isSubmitting}
                                                                        className="btn btn-secondary btn-sm !p-1 !text-[var(--text-muted)] hover:!text-[var(--danger)]"
                                                                        title={t('tooltips.cancelPick')}
                                                                    >
                                                                        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="flex flex-col gap-3 lg:hidden">
                                                {pickedItems.map(pick => (
                                                    <div key={`mobile-picked-${pick.pickId}`} className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{pick.line?.productNumber || tCommon('unknown')}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate">{pick.line?.productDescription || ''}</div>
                                                            </div>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCancelPick(pick.pickId)}
                                                                    disabled={isSubmitting}
                                                                    className="btn btn-secondary btn-sm !p-1 !text-[var(--text-muted)] hover:!text-[var(--danger)]"
                                                                    title={t('tooltips.cancelPick')}
                                                                >
                                                                    {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.binLocation')}</div>
                                                                <div className="text-xs font-medium">{pick.binName || '-'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.pickQty')}</div>
                                                                <div className="text-xs font-medium flex items-center gap-1">
                                                                    {pick.line && !pick.line.isFullyPicked && (
                                                                        /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                                                                        <span className="material-symbols-outlined text-[16px] text-[var(--warning)]" title={t('tooltips.partiallyPicked')}>warning</span>
                                                                    )}
                                                                    {parseFloat(pick.quantity).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Shipped Table */}
                                    {shippedItems.length > 0 && (
                                        <div>
                                            <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('shipped')}</h4>
                                            <table className="table-lines opacity-70 hidden lg:table">
                                                <thead>
                                                    <tr>
                                                        <th>{t('columns.product')}</th>
                                                        <th>{t('columns.binLocation')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.ordered')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.remaining')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.onHand')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.pickQty')}</th>
                                                        <th>{t('columns.action')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {shippedItems.map(pick => (
                                                        <tr key={pick.pickId}>
                                                            <td>
                                                                <div className="font-bold">{pick.line?.productNumber || tCommon('unknown')}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{pick.line?.productDescription || ''}</div>
                                                            </td>
                                                            <td className="text-[var(--text-muted)]">{pick.binName || '-'}</td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.quantity).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.remaining).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }} className="text-[var(--text-muted)]">
                                                                <div>{pick.line ? parseFloat(pick.line.onHand).toLocaleString() : '-'}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="font-semibold">{parseFloat(pick.quantity).toLocaleString()}</div>
                                                            </td>
                                                            <td>
                                                                <span className="ml-2 text-xs font-bold text-[var(--text-muted)] inline-flex items-center">
                                                                    { }
                                                                    <span className="material-symbols-outlined text-[14px] mr-1">local_shipping</span>
                                                                    {t('statuses.dispatched')}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="flex flex-col gap-3 lg:hidden opacity-70">
                                                {shippedItems.map(pick => (
                                                    <div key={`mobile-shipped-${pick.pickId}`} className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{pick.line?.productNumber || tCommon('unknown')}</div>
                                                                <div className="text-xs text-[var(--text-muted)] truncate">{pick.line?.productDescription || ''}</div>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                                <span className="text-xs font-bold text-[var(--text-muted)] inline-flex items-center">
                                                                    { }
                                                                    <span className="material-symbols-outlined text-[14px] mr-1">local_shipping</span>
                                                                    {t('statuses.dispatched')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.binLocation')}</div>
                                                                <div className="text-xs font-medium">{pick.binName || '-'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.pickQty')}</div>
                                                                <div className="text-xs font-medium flex items-center gap-1">
                                                                    {parseFloat(pick.quantity).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
                        </>
                    );
                    
                    return actionFormContent;
                })()}
        />
    );
}
