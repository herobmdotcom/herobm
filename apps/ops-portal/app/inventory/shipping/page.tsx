'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { apiFetch, apiMutate } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────

interface ShippingOrder {
    id: string;
    orderNumber: string;
    name: string;
    customerName: string;
    customerOrderNumber: string;
    stateCode: string;
    createdOn: string | null;
    createdBy: string;
    currencyCode: string | null;
    shippabilityStatus: 'ready' | 'partial';
    totalShippableLines: number;
    totalLines: number;
}

interface ShippingLine {
    salesOrderLineId: string;
    lineNumber: number;
    productId: string;
    productNumber: string;
    productDescription: string;
    isPhysical: boolean;
    quantity: string;
    quantityPicked: string;
    quantityShipped: string;
    availableToShip: string;
}

interface ShipmentSummary {
    shipmentId: string;
    shipmentNumber: string;
    stateCode: string;
    notes: string | null;
    trackingNumber: string | null;
    createdOn: string;
    lineCount: number;
}

interface ShippingContext {
    lines: ShippingLine[];
    shipments: ShipmentSummary[];
}

// ── Page ─────────────────────────────────────────────────────────

export default function ShippingPage() {
    const t = useTranslations('shipping');
    const tCommon = useTranslations('common');
    useDocumentTitle('Shipping');
    const { app } = useSettings();

    // Location
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');

    // Queue
    const [orders, setOrders] = useState<ShippingOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<ShippingOrder | null>(null);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [activeTab, setActiveTab] = useState<'ready' | 'partial'>('ready');

    // Context
    const [context, setContext] = useState<ShippingContext | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);

    // Form
    const [shipQtys, setShipQtys] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Locations ────────────────────────────────────────────────

    useEffect(() => {
        apiFetch<any>('/api/inventory/locations')
            .then(response => {
                const locs = response.data || [];
                setLocations(locs);
                if (locs.length > 0) {
                    const defaultLocId = app?.defaultFulfillmentLocationId || locs[0].locationId;
                    setSelectedLocationId(defaultLocId);
                }
            })
            .catch(err => console.error('Failed to load locations', err));
    }, [app?.defaultFulfillmentLocationId]);

    // ── Queue ────────────────────────────────────────────────────

    const loadOrders = useCallback(() => {
        setLoadingOrders(true);
        const endpoint = selectedLocationId
            ? `/api/sales-orders/shipping-queue?locationId=${selectedLocationId}`
            : '/api/sales-orders/shipping-queue';

        apiFetch<ShippingOrder[]>(endpoint)
            .then(data => setOrders(data || []))
            .catch(err => {
                console.error(t('errors.failedToLoadOrders'), err);
                setOrders([]);
            })
            .finally(() => setLoadingOrders(false));
    }, [selectedLocationId, t]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => o.shippabilityStatus === activeTab);
    }, [orders, activeTab]);

    // ── Context ──────────────────────────────────────────────────

    const loadContext = useCallback(() => {
        if (!selectedOrder) {
            setContext(null);
            return;
        }

        setLoadingContext(true);
        setError(null);
        apiFetch<ShippingContext>(`/api/sales-orders/${selectedOrder.id}/shipping-context`)
            .then((data) => {
                setContext(data);
                // Pre-fill ship quantities with available-to-ship
                const defaults: Record<string, string> = {};
                data.lines.forEach(line => {
                    const available = parseFloat(line.availableToShip);
                    if (available > 0) {
                        defaults[line.salesOrderLineId] = String(available);
                    }
                });
                setShipQtys(defaults);
                setNotes('');
                setTrackingNumber('');
            })
            .catch(err => setError(err.message))
            .finally(() => setLoadingContext(false));
    }, [selectedOrder]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    // ── Mutations ────────────────────────────────────────────────

    const handleCreateShipment = async () => {
        if (!selectedOrder || !context) return;

        const lines = context.lines
            .filter(l => {
                const qty = parseFloat(shipQtys[l.salesOrderLineId] || '0');
                return qty > 0;
            })
            .map(l => ({
                salesOrderLineId: l.salesOrderLineId,
                quantityShipped: shipQtys[l.salesOrderLineId],
            }));

        if (lines.length === 0) {
            setError(t('errors.atLeastOneLine'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await apiMutate(`/api/sales-orders/${selectedOrder.id}/shipments`, 'POST', {
                notes: notes || undefined,
                trackingNumber: trackingNumber || undefined,
                lines,
            });
            toast.success(t('toasts.shipmentCreated'));
            await loadContext();
            loadOrders();
        } catch (err: any) {
            setError(err.message || t('errors.failedToCreate'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Computed ─────────────────────────────────────────────────

    const shippableLines = useMemo(() => {
        if (!context) return [];
        return context.lines.filter(l => parseFloat(l.availableToShip) > 0);
    }, [context]);

    const totalShippable = shippableLines.length;
    const totalLines = context?.lines.filter(l => l.isPhysical).length ?? 0;

    // ── Render ───────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {t('title')}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">Location:</span>
                    <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="input text-sm w-48"
                    >
                        {locations.map(loc => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {loc.code} - {loc.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-6">
                {/* Left Pane: Order List */}
                <div className="w-1/3 lg:w-1/4 flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
                    <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-bold pt-1 px-1 gap-1">
                        <button 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'ready' ? 'border-[var(--success)] text-[var(--success)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('ready')}
                        >
                            {t('tabs.ready')} <span className="ml-1 opacity-75 font-normal">({orders.filter(o => o.shippabilityStatus === 'ready').length})</span>
                        </button>
                        <button 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'partial' ? 'border-[var(--warning)] text-[var(--warning)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('partial')}
                        >
                            {t('tabs.partial')} <span className="ml-1 opacity-75 font-normal">({orders.filter(o => o.shippabilityStatus === 'partial').length})</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingOrders ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">local_shipping</span>
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
                                                <span className={`material-symbols-outlined indicator-icon shrink-0 ${order.shippabilityStatus === 'ready' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`} style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span>
                                                <div className="font-bold text-[var(--text-primary)] text-sm">{order.orderNumber}</div>
                                            </div>
                                            <StateBadge state={order.stateCode as ValidState} />
                                        </div>
                                        <div className="text-xs font-bold text-[var(--text-secondary)] mb-1 pl-7">{order.customerName}</div>
                                        <div className="flex items-center justify-between pl-7">
                                            <div className="text-xs text-[var(--text-muted)] truncate">{order.name || order.customerOrderNumber}</div>
                                            <span className="text-[10px] font-bold bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full shrink-0 ml-2">
                                                {order.totalShippableLines}/{order.totalLines}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Shipment Form */}
                <div className="flex-1 flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
                    {!selectedOrder ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">local_shipping</span>
                            {t('selectOrder')}
                        </div>
                    ) : loadingContext ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                            {t('loadingOrder')}
                        </div>
                    ) : context ? (
                        <>
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
                                <h2 className="text-sm text-[var(--text-primary)] uppercase tracking-wider truncate mr-4 flex items-center gap-4">
                                    <Link href={`/sales-orders/${selectedOrder.id}`} className="font-bold shrink-0 hover:text-[var(--accent)] hover:underline transition-colors">
                                        {selectedOrder.orderNumber}
                                    </Link>
                                    <span className="text-[var(--text-muted)] opacity-50">&middot;</span>
                                    <span className="truncate">{selectedOrder.name || 'No Name'}</span>
                                    <span className="text-[var(--text-muted)] opacity-50">&middot;</span>
                                    <span className="truncate">{selectedOrder.customerName}</span>
                                </h2>
                                <div className="flex items-center shrink-0">
                                    <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {totalShippable} / {totalLines}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex flex-col h-full w-full">
                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-8">
                                        {/* Ship Form Header Fields */}
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                                                    {t('columns.trackingNumber')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={trackingNumber}
                                                    onChange={e => setTrackingNumber(e.target.value)}
                                                    placeholder={t('placeholders.tracking')}
                                                    className="input w-full"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
                                                    {t('columns.notes')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={notes}
                                                    onChange={e => setNotes(e.target.value)}
                                                    placeholder={t('placeholders.notes')}
                                                    className="input w-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Lines Table */}
                                        <div>
                                            <table className="table-lines">
                                                <thead>
                                                    <tr>
                                                        <th>{t('columns.product')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.ordered')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.picked')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.shipped')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.available')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('columns.qtyToShip')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {context.lines.filter(l => l.isPhysical).map(line => {
                                                        const available = parseFloat(line.availableToShip);
                                                        const hasStock = available > 0;
                                                        return (
                                                            <tr key={line.salesOrderLineId} className={!hasStock ? 'opacity-50' : ''}>
                                                                <td>
                                                                    <div className="font-bold">{line.productNumber}</div>
                                                                    <div className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">{line.productDescription}</div>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    {parseFloat(line.quantity).toLocaleString()}
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    {parseFloat(line.quantityPicked).toLocaleString()}
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    {parseFloat(line.quantityShipped).toLocaleString()}
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <span className={hasStock ? 'font-semibold text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                                                                        {available.toLocaleString()}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    {hasStock ? (
                                                                        <div className="flex justify-end">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                max={available}
                                                                                value={shipQtys[line.salesOrderLineId] || ''}
                                                                                onChange={(e) => setShipQtys(prev => ({
                                                                                    ...prev,
                                                                                    [line.salesOrderLineId]: e.target.value
                                                                                }))}
                                                                                className="input"
                                                                                style={{ width: '80px', textAlign: 'right', padding: '2px 6px', fontSize: '13px' }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[var(--text-muted)]">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {context.lines.filter(l => l.isPhysical).length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-muted)]">
                                                                No physical lines on this order.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Create Button */}
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCreateShipment}
                                                disabled={isSubmitting || shippableLines.length === 0}
                                                className="btn btn-primary"
                                            >
                                                {t('buttons.createShipment')}
                                            </button>
                                        </div>

                                        {/* Existing Shipments */}
                                        {context.shipments.length > 0 && (
                                            <div>
                                                <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('existingShipments')}</h4>
                                                <div className="flex flex-col gap-2">
                                                    {context.shipments.map(shipment => (
                                                        <div
                                                            key={shipment.shipmentId}
                                                            className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="material-symbols-outlined text-[var(--text-muted)] text-lg">inventory_2</span>
                                                                <div>
                                                                    <Link href={`/shipments/${shipment.shipmentId}`} className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline">
                                                                        {shipment.shipmentNumber}
                                                                    </Link>
                                                                    <div className="text-xs text-[var(--text-muted)]">
                                                                        {new Date(shipment.createdOn).toLocaleDateString()} · {t('shipmentLines', { count: shipment.lineCount })}
                                                                        {shipment.trackingNumber && (
                                                                            <span> · {shipment.trackingNumber}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <StateBadge state={shipment.stateCode as ValidState} />
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-sm flex items-center"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const { apiFetchBlob } = await import('@/lib/api');
                                                                            const blob = await apiFetchBlob(`/api/reports/hooks/shipping-docket/run?id=${shipment.shipmentId}&context=shipment`, { method: 'POST' });
                                                                            const url = URL.createObjectURL(blob);
                                                                            window.open(url, '_blank');
                                                                        } catch (err) {
                                                                            console.error('Failed to generate shipping docket', err);
                                                                            toast.error('Failed to generate shipping docket.');
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className="font-medium">Docket PDF</span>
                                                                </button>
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
                </div>
            </div>
        </div>
    );
}
