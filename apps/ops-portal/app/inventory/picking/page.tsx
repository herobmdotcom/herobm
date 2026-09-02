'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import MasterDetailLayout from '@/components/shared/MasterDetailLayout';
import InlineAlert from '@/components/shared/InlineAlert';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';

import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { SALES_ORDER_PICK_STATE } from '@herobm/shared';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import PickingOrderLinesView from '../components/PickingOrderLinesView';

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
    type?: 'sales_order' | 'transfer_order' | 'work_order';
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
    isCreditBlocked?: boolean;
    lines: PickingLine[];
    picks: PickAllocation[];
}

export default function PickingPage() {
    const t = useTranslations('picking');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const { app } = useSettings();
    // Location
    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('picking-location', 'UNSET');
    const [pendingOrders, setPendingOrders] = useState<UnifiedOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [activeTab, setActiveTab] = useState<'ready' | 'partial' | 'blocked'>('ready');
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [paginationMeta, setPaginationMeta] = useState({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        readyCount: 0,
        partialCount: 0,
        blockedCount: 0,
    });
    
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
            })
            .catch(err => reportError(err, 'Failed to load locations'));
    }, []);

    useEffect(() => {
        if (locReady && locations.length > 0) {
            if (selectedLocationId === 'UNSET') {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId as string);
            } else if (selectedLocationId !== '' && !locations.some(l => l.locationId === selectedLocationId)) {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId as string);
            }
        }
    }, [locReady, locations, selectedLocationId, app?.defaultFulfillmentLocationId, setSelectedLocationId]);

    // Fetch Pending Orders
    const loadOrders = useCallback(() => {
        if (!locReady || selectedLocationId === 'UNSET') return;
        setLoadingOrders(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
        const params: any = {
            status: activeTab,
            page,
            limit,
        };
        if (selectedLocationId && selectedLocationId !== 'UNSET') params.locationId = selectedLocationId;

        api.orderPickingControllerGetPickingQueue(params)
            .then(res => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                const raw = res.data as any;
                if (raw && Array.isArray(raw.data)) {
                    setPendingOrders(raw.data as unknown as UnifiedOrder[]);
                    if (raw.meta) {
                        setPaginationMeta(raw.meta);
                    }
                } else if (Array.isArray(raw)) {
                    const allOrders = raw as unknown as UnifiedOrder[];
                    const readyCount = allOrders.filter(o => o.pickabilityStatus === 'ready').length;
                    const partialCount = allOrders.filter(o => o.pickabilityStatus === 'partial').length;
                    const blockedCount = allOrders.filter(o => o.pickabilityStatus === 'blocked').length;
                    const tabFiltered = allOrders.filter(o => o.pickabilityStatus === activeTab);
                    const total = tabFiltered.length;
                    const totalPages = Math.ceil(total / limit) || 1;
                    const startIndex = (page - 1) * limit;
                    
                    setPendingOrders(tabFiltered.slice(startIndex, startIndex + limit));
                    setPaginationMeta({
                        total,
                        page,
                        limit,
                        totalPages,
                        readyCount,
                        partialCount,
                        blockedCount,
                    });
                }
            })
            .catch(err => reportError(err, 'Failed to load pending orders'))
            .finally(() => setLoadingOrders(false));
    }, [selectedLocationId, locReady, activeTab, page, limit]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const handleTabChange = (tab: 'ready' | 'partial' | 'blocked') => {
        setActiveTab(tab);
        setPage(1);
    };

    const filteredOrders = useMemo(() => {
        const list = [...pendingOrders];
        list.sort((a, b) => {
            if (a.hasAllocation !== b.hasAllocation) return a.hasAllocation ? -1 : 1;
            return 0;
        });
        return list;
    }, [pendingOrders]);

    // Fetch Summary for Selected Order
    const loadSummary = useCallback(() => {
        if (!selectedOrder) {
            setPickingSummary(null);
            return;
        }

        setLoadingSummary(true);
        setError(null);
        
        let summaryPromise;
        if (selectedOrder.type === 'transfer_order') {
            summaryPromise = api.transfersControllerGetPickingSummary(selectedOrder.id);
        } else if (selectedOrder.type === 'work_order') {
            summaryPromise = api.workOrdersControllerGetPickingSummary(selectedOrder.id);
        } else {
            summaryPromise = api.orderPickingControllerGetPickingSummary(selectedOrder.id);
        }
            
        summaryPromise
            .then((res: { data: unknown }) => {
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
            .catch((err: unknown) => setError(getErrorMessage(err)))
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
            } else if (selectedOrder.type === 'work_order') {
                await api.workOrdersControllerPickLine(selectedOrder.id, lineId, { binId: input.binId, quantity: input.quantity });
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
            } else if (selectedOrder.type === 'work_order') {
                await api.workOrdersControllerCancelPick(selectedOrder.id, pickId);
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

    return (
        <MasterDetailLayout
            title={t('title')}
            controls={
                <>
                    <span className="text-sm font-semibold text-[var(--text-muted)] hidden sm:inline">{t('locationLabel')}</span>
                    <select
                        value={selectedLocationId === 'UNSET' ? '' : selectedLocationId}
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
                    <div className="lg:bg-[var(--bg-secondary)] pt-1 lg:px-1">
                        <Tabs<'ready' | 'partial' | 'blocked'>
                            tabs={[
                                {
                                    id: 'ready',
                                    label: t('tabs.ready'),
                                    color: 'emerald',
                                    badge: <span className="ml-1 opacity-75 font-normal">({paginationMeta.readyCount})</span>,
                                },
                                {
                                    id: 'partial',
                                    label: t('tabs.partial'),
                                    color: 'amber',
                                    badge: <span className="ml-1 opacity-75 font-normal">({paginationMeta.partialCount})</span>,
                                },
                                {
                                    id: 'blocked',
                                    label: t('tabs.blocked'),
                                    color: 'rose',
                                    badge: <span className="ml-1 opacity-75 font-normal">({paginationMeta.blockedCount})</span>,
                                },
                            ]}
                            activeTab={activeTab}
                            onChange={handleTabChange}
                            equalWidth
                        />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 bg-[var(--bg-card)] lg:bg-transparent rounded-b-md lg:rounded-none">
                        {loadingOrders ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                {t('noOrders', { tab: activeTab })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredOrders.map(order => (
                                    <div 
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`p-3.5 rounded-lg border cursor-pointer transition-colors active:scale-[0.99] touch-manipulation min-h-[56px] ${selectedOrder?.id === order.id ? 'bg-[var(--bg-secondary-hover)] border-[var(--accent)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                {order.hasAllocation ? (
                                                    /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                                                    <span className={`material-symbols-outlined indicator-icon shrink-0 [font-variation-settings:'FILL'_1] ${order.pickabilityStatus === 'ready' ? 'text-emerald-500' : order.pickabilityStatus === 'partial' ? 'text-amber-500' : 'text-rose-500'}`} title={t('tooltips.allocated')}>bookmark</span>
                                                ) : (
                                                    <span className={`material-symbols-outlined indicator-icon shrink-0 [font-variation-settings:'FILL'_1] ${order.pickabilityStatus === 'ready' ? 'text-emerald-500' : order.pickabilityStatus === 'partial' ? 'text-amber-500' : 'text-rose-500'}`}>fiber_manual_record</span>
                                                )}
                                                <div className="font-bold text-[var(--text-primary)] text-sm">{order.orderNumber}</div>
                                                {order.type === 'transfer_order' && (
                                                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        TRANSFER
                                                    </span>
                                                )}
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

                    {/* Tablet-optimized Bottom Pagination Bar */}
                    <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between gap-2 shrink-0 select-none text-xs">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={page <= 1 || loadingOrders}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="min-h-[44px] min-w-[44px] px-3 font-semibold flex items-center gap-1 active:scale-95 touch-manipulation"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                            <span className="hidden sm:inline">{t('pagination.previous')}</span>
                        </Button>

                        <div className="text-center font-semibold text-[var(--text-secondary)]">
                            <span className="text-[var(--text-primary)] font-bold">
                                {t('pagination.pageOf', { page: paginationMeta.page || page, totalPages: paginationMeta.totalPages || 1 })}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-normal block sm:inline sm:ml-1.5">
                                {t('pagination.totalOrders', { total: paginationMeta.total || filteredOrders.length })}
                            </span>
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={page >= (paginationMeta.totalPages || 1) || loadingOrders}
                            onClick={() => setPage(p => p + 1)}
                            className="min-h-[44px] min-w-[44px] px-3 font-semibold flex items-center gap-1 active:scale-95 touch-manipulation"
                        >
                            <span className="hidden sm:inline">{t('pagination.next')}</span>
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </Button>
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
                                    <Button 
                                        onClick={handlePrintDocket} 
                                        loading={isGeneratingPdf}
                                        variant="secondary"
                                        size="sm"
                                        className="flex items-center gap-1.5"
                                    >
                                        <span>{t('pickingSlipPdf')}</span>
                                    </Button>
                                    <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pickingSummary.fullyPickedLines} / {pickingSummary.totalLines}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex flex-col h-full w-full">
                                    {error && (
                                        <div className="mb-4">
                                            <InlineAlert type="error" message={error} />
                                        </div>
                                    )}
                                    
                                    {pickingSummary.isCreditBlocked && (
                                        <div className="mb-4">
                                            <InlineAlert type="warning" message={`${t('creditBlockedTitle')}: ${t('creditBlockedMessage')}`} />
                                        </div>
                                    )}

                                    <PickingOrderLinesView
                                        lines={pickingSummary.lines}
                                        picks={pickingSummary.picks}
                                        pickInputs={pickInputs}
                                        onPickInputChange={(lineId, input) => {
                                            setPickInputs(prev => ({
                                                ...prev,
                                                [lineId]: {
                                                    quantity: input.quantity ?? prev[lineId]?.quantity ?? '',
                                                    binId: input.binId ?? prev[lineId]?.binId ?? ''
                                                }
                                            }));
                                        }}
                                        onPickLine={handlePickLine}
                                        onCancelPick={handleCancelPick}
                                        isSubmitting={isSubmitting}
                                    /></div>
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
