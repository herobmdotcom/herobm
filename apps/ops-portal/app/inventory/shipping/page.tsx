'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { formatLocalDate } from '@/lib/date';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import MasterDetailLayout from '@/components/shared/MasterDetailLayout';
import InlineAlert from '@/components/shared/InlineAlert';
import { getErrorMessage } from '@herobm/shared';
import AddressDisplay from '@/components/shared/AddressDisplay';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { Button } from '@/components/shared/Button';

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
    type?: 'sales_order' | 'transfer_order';
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
    productType?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    order: any;
    lines: ShippingLine[];
    shipments: ShipmentSummary[];
}

// ── Page ─────────────────────────────────────────────────────────

export default function ShippingPage() {
    const t = useTranslations('shipping');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const { app } = useSettings();

    // Location
    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('shipping-location', 'UNSET');

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
        api.inventoryControllerFindAllLocations({} )
            .then((response) => {
                const res = response.data as unknown;
                const locs = (Array.isArray(res) ? res : ((res as { data?: unknown[] })?.data || [])) as api.InventoryLocationResponseDto[];
                setLocations(locs);
            })
            .catch(err => reportError(err, 'Failed to load locations'));
    }, []);

    useEffect(() => {
        if (locReady && locations.length > 0) {
            if (selectedLocationId === 'UNSET') {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId);
            } else if (selectedLocationId !== '' && !locations.some(l => l.locationId === selectedLocationId)) {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId);
            }
        }
    }, [locReady, locations, selectedLocationId, app?.defaultFulfillmentLocationId, setSelectedLocationId]);

    // ── Queue ────────────────────────────────────────────────────

    const loadOrders = useCallback(() => {
        if (!locReady) return;
        setLoadingOrders(true);
        const params: { locationId?: string } = {};
        if (selectedLocationId && selectedLocationId !== 'UNSET') params.locationId = selectedLocationId;

        api.orderPickingControllerGetShippingQueue(params)
            .then(response => {
                setOrders(response.data as ShippingOrder[] || []);
            }).catch(err => {
                reportError(err, t('errors.failedToLoadOrdersError'));
                setOrders([]);
            })
            .finally(() => setLoadingOrders(false));
    }, [selectedLocationId, t, locReady]);

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
        api.orderPickingControllerGetShippingContext(selectedOrder.id)
            .then((response) => {
                const data = response.data ;
                setContext(data as unknown as ShippingContext);
                // Pre-fill ship quantities with available-to-ship
                const defaults: Record<string, string> = {};
                data.lines.forEach((line: ShippingLine) => {
                    const available = parseFloat(line.availableToShip);
                    if (available > 0) {
                        defaults[line.salesOrderLineId] = String(available);
                    }
                });
                setShipQtys(defaults);
                setNotes('');
                setTrackingNumber('');
            })
            .catch(err => setError(getErrorMessage(err)))
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
            setError(t('errors.atLeastOneLineError'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await api.orderShipmentsControllerCreateShipment(selectedOrder.id, {
                notes: notes || undefined,
                trackingNumber: trackingNumber || undefined,
                lines,
            });
            toast.success(t('toasts.shipmentCreated'));
            await loadContext();
            loadOrders();
        } catch (err: unknown) {
            setError(getErrorMessage(err) || t('errors.failedToCreateError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Computed ─────────────────────────────────────────────────

    const activeLines = useMemo(() => {
        if (!context) return [];
        return context.lines.filter(l => parseFloat(l.quantity) > 0);
    }, [context]);

    const activePhysicalLines = useMemo(() => {
        return activeLines.filter(l => l.isPhysical);
    }, [activeLines]);

    const shippableLines = useMemo(() => {
        return activePhysicalLines.filter(l => parseFloat(l.availableToShip) > 0);
    }, [activePhysicalLines]);

    const sortedLines = useMemo(() => {
        return [...activeLines].sort((a, b) => {
            if (a.isPhysical === b.isPhysical) {
                return a.lineNumber - b.lineNumber;
            }
            return a.isPhysical ? -1 : 1;
        });
    }, [activeLines]);

    const totalShippable = shippableLines.length;
    const totalLines = activePhysicalLines.length;

    const actionFormContent = (
        <>
            {!selectedOrder ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                    { }
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
                            <Link href={selectedOrder.type === 'transfer_order' ? `/inventory/transfers/${selectedOrder.id}` : `/sales-orders/${selectedOrder.id}`} className="font-bold shrink-0 hover:text-[var(--accent)] hover:underline transition-colors">
                                {selectedOrder.orderNumber}
                            </Link>
                            <span className="text-[var(--text-muted)] opacity-50">&middot;</span>
                            <span className="truncate">{selectedOrder.name || t('noName')}</span>
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
                                <div className="mb-4">
                                    <InlineAlert type="error" message={error} />
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Delivery Address & Shipping Notes */}
                                {(context.order.deliveryAddressLine1 || context.order.shippingNotes) && (
                                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                        {(context.order.deliveryAddressLine1) && (
                                            <div className="flex-1">
                                                { }
                                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                    {/* eslint-disable-next-line no-restricted-syntax -- legacy */}
                                                    {context.order.type === 'transfer_order' ? 'Destination Location' : 'Delivery Address'}
                                                </label>
                                                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                                                    <AddressDisplay
                                                        addressLine1={context.order.deliveryAddressLine1}
                                                        addressLine2={context.order.deliveryAddressLine2}
                                                        city={context.order.deliveryCity}
                                                        stateOrProvince={context.order.deliveryState}
                                                        postalCode={context.order.deliveryPostalCode}
                                                        country={context.order.deliveryCountry}
                                                        phone={context.order.deliveryPhone}
                                                        recipientName={context.order.deliveryName}
                                                        companyName={context.order.deliveryCompanyName ?? undefined}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {context.order.shippingNotes && (
                                            <div className="flex-1">
                                                { }
                                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                    Shipping Instructions
                                                </label>
                                                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                                                    {context.order.shippingNotes}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Ship Form Header Fields */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
                                    {/* Mobile Cards */}
                                    <div className="lg:hidden flex flex-col gap-3">
                                        {sortedLines.map(line => {
                                            const available = parseFloat(line.availableToShip);
                                            const isPhysical = line.isPhysical;
                                            const hasStock = isPhysical && available > 0;
                                            return (
                                                <div key={line.salesOrderLineId} className={`p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg ${isPhysical && !hasStock ? 'opacity-50' : ''}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="font-bold">{line.productNumber}</div>
                                                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                                                {!isPhysical && <span className="uppercase text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded mr-2 font-bold">{line.productType}</span>}
                                                                {line.productDescription}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end">
                                                            <div className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('columns.qtyToShip')}</div>
                                                            {hasStock ? (
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
                                                                    className="input w-24 text-right"
                                                                />
                                                            ) : (
                                                                <span className="text-[var(--text-muted)]">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.ordered')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.quantity).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.picked')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.quantityPicked).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.shipped')}</div>
                                                            <div className="text-xs font-medium">{parseFloat(line.quantityShipped).toLocaleString()}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.available')}</div>
                                                            <div className={`text-xs font-semibold ${hasStock ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                                                                {available.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {sortedLines.length === 0 && (
                                            <div className="py-6 text-center text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">
                                                {t('noPhysicalLines')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Desktop Table */}
                                    <table className="table-lines hidden lg:table">
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
                                            {sortedLines.map(line => {
                                                const available = parseFloat(line.availableToShip);
                                                const isPhysical = line.isPhysical;
                                                const hasStock = isPhysical && available > 0;
                                                return (
                                                    <tr key={line.salesOrderLineId} className={isPhysical && !hasStock ? 'opacity-50' : ''}>
                                                        <td>
                                                            <div className="font-bold">
                                                                {line.productNumber}
                                                                {!isPhysical && <span className="ml-2 uppercase text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-bold text-[var(--text-muted)]">{line.productType}</span>}
                                                            </div>
                                                            <div className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">{line.productDescription}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {parseFloat(line.quantity).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {isPhysical ? parseFloat(line.quantityPicked).toLocaleString() : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {isPhysical ? parseFloat(line.quantityShipped).toLocaleString() : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <span className={hasStock ? 'font-semibold text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                                                                {isPhysical ? available.toLocaleString() : '-'}
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
                                            {sortedLines.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-muted)]">
                                                        {t('noPhysicalLines')}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Create Button */}
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={handleCreateShipment}
                                        disabled={isSubmitting || shippableLines.length === 0}
                                        variant="primary"
                                    >
                                        {t('buttons.createShipment')}
                                    </Button>
                                </div>

                                {/* Existing Shipments */}
                                {context.shipments.length > 0 && (
                                    <div>
                                        <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('existingShipments')}</h4>
                                        <div className="flex flex-col gap-2">
                                            {context.shipments.map(shipment => (
                                                <div
                                                    key={shipment.shipmentId}
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors gap-4 mt-2"
                                                >
                                                    <div className="flex items-start sm:items-center gap-3">
                                                        { }
                                                        <span className="material-symbols-outlined text-[var(--text-muted)] text-xl mt-0.5 sm:mt-0 shrink-0">inventory_2</span>
                                                        <div className="min-w-0">
                                                            <Link href={`/shipments/${shipment.shipmentId}`} className="font-bold text-base text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline break-all sm:break-normal">
                                                                {shipment.shipmentNumber}
                                                            </Link>
                                                            <div className="text-xs text-[var(--text-muted)] mt-1">
                                                                {formatLocalDate(shipment.createdOn)} · {t('shipmentLines', { count: shipment.lineCount })}
                                                                {shipment.trackingNumber && (
                                                                    <span> · {shipment.trackingNumber}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0 w-full sm:w-auto">
                                                        <StateBadge state={shipment.stateCode as ValidState} />
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            className="flex items-center"
                                                            onClick={async () => {
                                                                try {
                                                                    const { reportError } = await import('@/lib/api');
                                                                    const api = await import('@herobm/sdk');
                                                                    const res = await api.pdfTemplatesControllerRunHook('shipping-docket', { shipmentId: shipment.shipmentId }, { id: shipment.shipmentId, context: 'shipment' });
                                                                    const blob = res.data as Blob;
                                                                    const url = URL.createObjectURL(blob);
                                                                    window.open(url, '_blank');
                                                                } catch (err) {
                                                                    reportError(err, 'Failed to generate shipping docket');
                                                                    toast.error(t('errors.failedToGenerateDocketError'));
                                                                }
                                                            }}
                                                        >
                                                            <span className="font-medium">{t('docketPdf')}</span>
                                                        </Button>
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

    // ── Render ───────────────────────────────────────────────────

    return (
        <MasterDetailLayout
            title={t('title')}
            controls={
                <>
                    <span className="text-sm font-semibold text-[var(--text-muted)] hidden sm:inline">{tCommon('location')}:</span>
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
            masterWidthClass="lg:w-1/3"
            isDetailOpen={!!selectedOrder}
            onCloseDetail={() => { setSelectedOrder(null); setContext(null); }}
            detailTitle={selectedOrder ? selectedOrder.orderNumber : undefined}
            masterPane={
                <>
                    <div className="flex lg:border-b lg:border-[var(--border)] lg:bg-[var(--bg-secondary)] text-xs font-bold pt-1 lg:px-1 gap-1 border-b border-[var(--border)]">
                        <Button variant="ghost" 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'ready' ? 'border-[var(--success)] text-[var(--success)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('ready')}
                        >
                            {t('tabs.ready')} <span className="ml-1 opacity-75 font-normal">({orders.filter(o => o.shippabilityStatus === 'ready').length})</span>
                        </Button>
                        <Button variant="ghost" 
                            className={`flex-1 py-2.5 px-2 text-center border-b-2 rounded-t-md transition-colors ${activeTab === 'partial' ? 'border-[var(--warning)] text-[var(--warning)] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}
                            onClick={() => setActiveTab('partial')}
                        >
                            {t('tabs.partial')} <span className="ml-1 opacity-75 font-normal">({orders.filter(o => o.shippabilityStatus === 'partial').length})</span>
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 pb-24 lg:pb-2 bg-[var(--bg-card)] lg:bg-transparent rounded-b-md lg:rounded-none">
                        {loadingOrders ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
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
                                                { }
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
                </>
            }
            detailPane={actionFormContent}
        />
    );
}
