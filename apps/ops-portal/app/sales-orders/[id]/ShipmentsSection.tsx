'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import { getErrorMessage, SHIPMENT_STATE } from '@herobm/shared';
import * as api from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { routes } from '@/lib/routes';
import { Button } from '@/components/shared/Button';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { toast } from 'react-hot-toast';
import { formatQuantity } from '@/lib/formatters';
import {
    calculateShippableQuantities,
    calculatePickAndShipQuantities,
} from '@/lib/sales-order-utils';
import type { OrderDetail } from './types';

export interface ShipmentLine {
    shipmentLineId: string;
    salesOrderLineId: string;
    quantityShipped: string;
}

export interface Shipment {
    shipmentId: string;
    shipmentNumber: string;
    stateCode: string;
    notes: string | null;
    trackingNumber: string | null;
    createdOn: string;
    createdBy: string;
    lines: ShipmentLine[];
}

export interface NewShipmentLine {
    salesOrderLineId: string;
    quantityToShip: string;
    maxQuantity: number;
}

export interface PickAndShipLine {
    salesOrderLineId: string;
    quantityToShip: string;
    maxQuantity: number;
}

export interface ShipmentsSectionProps {
    orderId: string;
    order?: OrderDetail;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
    pickingSummary?: any | null;
    loadOrder?: (autoTransitions?: unknown[], showSpinner?: boolean) => Promise<void>;
    setError?: (msg: string) => void;
}

export default function ShipmentsSection({
    orderId,
    order,
    pickingSummary,
    loadOrder,
    setError: parentSetError,
}: ShipmentsSectionProps) {
    const tShipping = useTranslations('shipping');
    const tCommon = useTranslations('common');

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateShipment, setShowCreateShipment] = useState(false);
    const [newTrackingNumber, setNewTrackingNumber] = useState('');
    const [newShipmentNotes, setNewShipmentNotes] = useState('');
    const [newShippingNotes, setNewShippingNotes] = useState('');
    const [newShipmentLines, setNewShipmentLines] = useState<NewShipmentLine[]>([]);

    const [showPickAndShip, setShowPickAndShip] = useState(false);
    const [pickAndShipTrackingNumber, setPickAndShipTrackingNumber] = useState('');
    const [pickAndShipNotes, setPickAndShipNotes] = useState('');
    const [pickAndShipShippingNotes, setPickAndShipShippingNotes] = useState('');
    const [pickAndShipLines, setPickAndShipLines] = useState<PickAndShipLine[]>([]);

    const [submitting, setSubmitting] = useState(false);

    const setError = (msg: string) => {
        if (parentSetError) parentSetError(msg);
        if (msg) toast.error(msg);
    };

    const loadShipments = useCallback(async () => {
        try {
            const res = await api.orderShipmentsControllerFindShipments(orderId);
            setShipments((res.data || []) as unknown as Shipment[]);
        } catch (err) {
            reportError(err, 'ShipmentsSection');
            setError(getErrorMessage(err));
            setShipments([]);
        }
    }, [orderId]);

    useEffect(() => {
        setLoading(true);
        loadShipments().finally(() => setLoading(false));
    }, [loadShipments]);

    const handleCreateClick = () => {
        if (!order?.lines) return;
        const shippable = calculateShippableQuantities(
            order.lines,
            shipments,
            pickingSummary?.lines,
        ).map(l => ({
            salesOrderLineId: l.salesOrderLineId,
            quantityToShip: l.defaultQty,
            maxQuantity: l.maxQty,
        }));
        setNewShipmentLines(shippable);
        setNewTrackingNumber('');
        setNewShipmentNotes('');
        setNewShippingNotes(order?.shippingNotes || '');
        setShowCreateShipment(true);
        setShowPickAndShip(false);
    };

    const handleCancelCreate = () => {
        setShowCreateShipment(false);
        setNewShipmentLines([]);
        setNewTrackingNumber('');
        setNewShipmentNotes('');
        setNewShippingNotes('');
    };

    const handleGenerateShipment = async () => {
        const linesToShip = newShipmentLines
            .filter(l => l.quantityToShip && parseFloat(l.quantityToShip) > 0)
            .map(l => ({
                salesOrderLineId: l.salesOrderLineId,
                quantityShipped: l.quantityToShip,
            }));

        if (linesToShip.length === 0) {
            setError(tShipping('errors.atLeastOneLineError'));
            return;
        }

        setSubmitting(true);
        try {
            await api.orderShipmentsControllerCreateShipment(orderId, {
                trackingNumber: newTrackingNumber || undefined,
                notes: newShipmentNotes || undefined,
                shippingNotes: newShippingNotes || undefined,
                lines: linesToShip,
            });
            toast.success(tShipping('toasts.shipmentCreated'));
            handleCancelCreate();
            await loadShipments();
            if (loadOrder) await loadOrder(undefined, false);
        } catch (err) {
            const msg = getErrorMessage(err) || tShipping('errors.failedToCreateError');
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePickAndShipClick = () => {
        if (!order?.lines) return;
        const pickShippable = calculatePickAndShipQuantities(
            order.lines,
            shipments,
            pickingSummary?.lines,
        ).map(l => ({
            salesOrderLineId: l.salesOrderLineId,
            quantityToShip: l.defaultQty,
            maxQuantity: l.maxQty,
        }));
        setPickAndShipLines(pickShippable);
        setPickAndShipTrackingNumber('');
        setPickAndShipNotes('');
        setPickAndShipShippingNotes(order?.shippingNotes || '');
        setShowPickAndShip(true);
        setShowCreateShipment(false);
    };

    const handleCancelPickAndShip = () => {
        setShowPickAndShip(false);
        setPickAndShipLines([]);
        setPickAndShipTrackingNumber('');
        setPickAndShipNotes('');
        setPickAndShipShippingNotes('');
    };

    const handleGeneratePickAndShip = async () => {
        const linesToFulfill = pickAndShipLines
            .filter(l => l.quantityToShip && parseFloat(l.quantityToShip) > 0)
            .map(l => ({
                salesOrderLineId: l.salesOrderLineId,
                quantityToFulfill: l.quantityToShip,
            }));

        if (linesToFulfill.length === 0) {
            setError(tShipping('errors.atLeastOneLineError'));
            return;
        }

        setSubmitting(true);
        try {
            await api.ordersControllerFulfillDirectOrder(orderId, {
                trackingNumber: pickAndShipTrackingNumber || undefined,
                notes: pickAndShipNotes || undefined,
                shippingNotes: pickAndShipShippingNotes || undefined,
                allowPartialFulfillment: true,
                lines: linesToFulfill,
            });
            toast.success(tShipping('toasts.orderFulfilled'));
            handleCancelPickAndShip();
            await loadShipments();
            if (loadOrder) await loadOrder(undefined, false);
        } catch (err) {
            const msg = getErrorMessage(err) || tShipping('errors.fulfillDirectFailed');
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isShippable = order?.lines
        ? calculateShippableQuantities(order.lines, shipments, pickingSummary?.lines).length > 0
        : false;

    const isPickAndShippable = order?.lines
        ? calculatePickAndShipQuantities(order.lines, shipments, pickingSummary?.lines).length > 0
        : false;

    return (
        <div id="shipments-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    <span className="material-symbols-outlined">inventory_2</span>
                    {tShipping('shipmentsTitle')}
                </h3>
                {order && ['shipped', 'picking', 'confirmed'].includes(order.stateCode) && !showCreateShipment && !showPickAndShip && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!isShippable}
                            onClick={handleCreateClick}
                        >
                            {tShipping('buttons.createShipment')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={!isPickAndShippable}
                            onClick={handlePickAndShipClick}
                        >
                            {tShipping('buttons.pickAndShip')}
                        </Button>
                    </div>
                )}
            </div>

            {showCreateShipment && (
                <div className="mb-4 p-4 rounded-lg border border-[var(--border)]">
                    <div className="mb-3">
                        <strong className="text-[13px] flex items-center">
                            {tShipping('buttons.createShipment')}
                        </strong>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('deliveryInstructions')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('deliveryInstructions')}
                                value={newShippingNotes}
                                onChange={e => setNewShippingNotes(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('columns.trackingNumber')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('placeholders.tracking')}
                                value={newTrackingNumber}
                                onChange={e => setNewTrackingNumber(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('columns.shipmentNotes')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('placeholders.shipmentNotes')}
                                value={newShipmentNotes}
                                onChange={e => setNewShipmentNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DataTable
                        data={newShipmentLines}
                        keyExtractor={(nl) => nl.salesOrderLineId}
                        columns={[
                            { header: '#', width: 40 },
                            { header: tShipping('columns.product') },
                            { header: tShipping('columns.description') },
                            { header: tShipping('columns.ordered'), align: 'right' },
                            { header: tShipping('columns.picked'), align: 'right' },
                            { header: tShipping('columns.shipped'), align: 'right' },
                            { header: tShipping('columns.qtyToShip'), width: 110, align: 'right' }
                        ]}
                        renderCustomRow={(nl, idx) => {
                            const origLine = order?.lines?.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : '—';
                            const shippedQty = shipments.reduce((sum, ship) => {
                                if (ship.stateCode === SHIPMENT_STATE.CANCELLED) return sum;
                                const sLine = ship.lines?.find(sl => sl.salesOrderLineId === nl.salesOrderLineId);
                                return sum + (sLine ? parseFloat(sLine.quantityShipped) : 0);
                            }, 0);

                            return (
                                <tr key={nl.salesOrderLineId}>
                                    <td className="text-[var(--text-muted)]">{origLine?.lineNumber}</td>
                                    <td className="font-semibold text-xs">
                                        {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                    </td>
                                    <td>{origLine?.productDescription || '—'}</td>
                                    <td className="text-right">{formatQuantity(origLine?.quantity)}</td>
                                    <td className="text-right">{pickedQty !== '—' ? formatQuantity(pickedQty) : '—'}</td>
                                    <td className="text-right">{formatQuantity(shippedQty)}</td>
                                    <td className="text-right">
                                        <input
                                            type="number"
                                            className="input w-[70px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13px] text-right"
                                            min="0"
                                            max={nl.maxQuantity}
                                            step="1"
                                            value={nl.quantityToShip}
                                            onChange={e => {
                                                const updated = [...newShipmentLines];
                                                let val = e.target.value;
                                                if (val === '') val = '0';
                                                else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                updated[idx].quantityToShip = val;
                                                setNewShipmentLines(updated);
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        }}
                        mobileCard={(nl, idx) => {
                            const origLine = order?.lines?.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : '—';
                            const shippedQty = shipments.reduce((sum, ship) => {
                                if (ship.stateCode === SHIPMENT_STATE.CANCELLED) return sum;
                                const sLine = ship.lines?.find(sl => sl.salesOrderLineId === nl.salesOrderLineId);
                                return sum + (sLine ? parseFloat(sLine.quantityShipped) : 0);
                            }, 0);

                            return (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="font-semibold text-sm text-[var(--accent)]">
                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{origLine?.lineNumber}</div>
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium mb-3">
                                        {origLine?.productDescription || '—'}
                                    </div>
                                    
                                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                        <MobileCardField label={tShipping('columns.ordered')} value={
                                            <span className="font-semibold">{formatQuantity(origLine?.quantity)}</span>
                                        } />
                                        <MobileCardField label={tShipping('columns.picked')} value={
                                            <span>{pickedQty !== '—' ? formatQuantity(pickedQty) : '—'}</span>
                                        } />
                                        <MobileCardField label={tShipping('columns.shipped')} value={
                                            <span>{formatQuantity(shippedQty)}</span>
                                        } />
                                        <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-2">
                                            <span className="text-xs font-semibold text-slate-700">{tShipping('columns.qtyToShip')}</span>
                                            <input
                                                type="number"
                                                className="input w-[80px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm text-right font-medium"
                                                min="0"
                                                max={nl.maxQuantity}
                                                step="1"
                                                value={nl.quantityToShip}
                                                onChange={e => {
                                                    const updated = [...newShipmentLines];
                                                    let val = e.target.value;
                                                    if (val === '') val = '0';
                                                    else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                    updated[idx].quantityToShip = val;
                                                    setNewShipmentLines(updated);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />

                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" size="sm" onClick={handleCancelCreate} disabled={submitting}>
                            {tCommon('cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleGenerateShipment}
                            disabled={submitting || newShipmentLines.every(l => !l.quantityToShip || parseFloat(l.quantityToShip) <= 0)}
                        >
                            {submitting ? tCommon('loading') : tShipping('buttons.createShipment')}
                        </Button>
                    </div>
                </div>
            )}

            {showPickAndShip && (
                <div className="mb-4 p-4 rounded-lg border border-[var(--border)]">
                    <div className="mb-3">
                        <strong className="text-[13px] flex items-center">
                            {tShipping('pickAndShipTitle')}
                        </strong>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('deliveryInstructions')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('deliveryInstructions')}
                                value={pickAndShipShippingNotes}
                                onChange={e => setPickAndShipShippingNotes(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('columns.trackingNumber')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('placeholders.tracking')}
                                value={pickAndShipTrackingNumber}
                                onChange={e => setPickAndShipTrackingNumber(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                                {tShipping('columns.shipmentNotes')}
                            </label>
                            <input
                                className="input w-full"
                                placeholder={tShipping('placeholders.shipmentNotes')}
                                value={pickAndShipNotes}
                                onChange={e => setPickAndShipNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DataTable
                        data={pickAndShipLines}
                        keyExtractor={(nl) => nl.salesOrderLineId}
                        columns={[
                            { header: '#', width: 40 },
                            { header: tShipping('columns.product') },
                            { header: tShipping('columns.description') },
                            { header: tShipping('columns.ordered'), align: 'right' },
                            { header: tShipping('columns.picked'), align: 'right' },
                            { header: tShipping('columns.shipped'), align: 'right' },
                            { header: tShipping('columns.qtyToPickAndShip'), width: 130, align: 'right' }
                        ]}
                        renderCustomRow={(nl, idx) => {
                            const origLine = order?.lines?.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : '—';
                            let shippedQty = shipments.reduce((sum, ship) => {
                                if (ship.stateCode === SHIPMENT_STATE.CANCELLED) return sum;
                                const sLine = ship.lines?.find(sl => sl.salesOrderLineId === nl.salesOrderLineId);
                                return sum + (sLine ? parseFloat(sLine.quantityShipped) : 0);
                            }, 0);
                            if (pLine && pLine.quantityShipped != null) {
                                const pShipped = parseFloat(pLine.quantityShipped);
                                if (pShipped > shippedQty) shippedQty = pShipped;
                            }

                            return (
                                <tr key={nl.salesOrderLineId}>
                                    <td className="text-[var(--text-muted)]">{origLine?.lineNumber}</td>
                                    <td className="font-semibold text-xs">
                                        {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                    </td>
                                    <td>{origLine?.productDescription || '—'}</td>
                                    <td className="text-right">{formatQuantity(origLine?.quantity)}</td>
                                    <td className="text-right">{pickedQty !== '—' ? formatQuantity(pickedQty) : '—'}</td>
                                    <td className="text-right">{formatQuantity(shippedQty)}</td>
                                    <td className="text-right">
                                        <input
                                            type="number"
                                            className="input w-[70px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13px] text-right"
                                            min="0"
                                            max={nl.maxQuantity}
                                            step="1"
                                            value={nl.quantityToShip}
                                            onChange={e => {
                                                const updated = [...pickAndShipLines];
                                                let val = e.target.value;
                                                if (val === '') val = '0';
                                                else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                updated[idx].quantityToShip = val;
                                                setPickAndShipLines(updated);
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        }}
                        mobileCard={(nl, idx) => {
                            const origLine = order?.lines?.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : '—';
                            let shippedQty = shipments.reduce((sum, ship) => {
                                if (ship.stateCode === SHIPMENT_STATE.CANCELLED) return sum;
                                const sLine = ship.lines?.find(sl => sl.salesOrderLineId === nl.salesOrderLineId);
                                return sum + (sLine ? parseFloat(sLine.quantityShipped) : 0);
                            }, 0);
                            if (pLine && pLine.quantityShipped != null) {
                                const pShipped = parseFloat(pLine.quantityShipped);
                                if (pShipped > shippedQty) shippedQty = pShipped;
                            }

                            return (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="font-semibold text-sm text-[var(--accent)]">
                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{origLine?.lineNumber}</div>
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium mb-3">
                                        {origLine?.productDescription || '—'}
                                    </div>
                                    
                                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                        <MobileCardField label={tShipping('columns.ordered')} value={
                                            <span className="font-semibold">{formatQuantity(origLine?.quantity)}</span>
                                        } />
                                        <MobileCardField label={tShipping('columns.picked')} value={
                                            <span>{pickedQty !== '—' ? formatQuantity(pickedQty) : '—'}</span>
                                        } />
                                        <MobileCardField label={tShipping('columns.shipped')} value={
                                            <span>{formatQuantity(shippedQty)}</span>
                                        } />
                                        <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-2">
                                            <span className="text-xs font-semibold text-slate-700">{tShipping('columns.qtyToPickAndShip')}</span>
                                            <input
                                                type="number"
                                                className="input w-[80px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm text-right font-medium"
                                                min="0"
                                                max={nl.maxQuantity}
                                                step="1"
                                                value={nl.quantityToShip}
                                                onChange={e => {
                                                    const updated = [...pickAndShipLines];
                                                    let val = e.target.value;
                                                    if (val === '') val = '0';
                                                    else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                    updated[idx].quantityToShip = val;
                                                    setPickAndShipLines(updated);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />

                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" size="sm" onClick={handleCancelPickAndShip} disabled={submitting}>
                            {tCommon('cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleGeneratePickAndShip}
                            disabled={submitting || pickAndShipLines.every(l => !l.quantityToShip || parseFloat(l.quantityToShip) <= 0)}
                        >
                            {submitting ? tCommon('loading') : tShipping('buttons.pickAndShip')}
                        </Button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                    {tCommon('loading')}
                </div>
            ) : shipments.length === 0 ? (
                <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                    {tShipping('noShipmentsFound')}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {shipments.map(shipment => (
                        <LinkedEntityCard
                            key={shipment.shipmentId}
                            icon="inventory_2"
                            title={shipment.shipmentNumber}
                            href={routes.shipments.detail(shipment.shipmentId)}
                            subtitle={[
                                formatLocalDate(shipment.createdOn),
                                tShipping('shipmentLines', { count: shipment.lines.length }),
                                shipment.trackingNumber || null,
                            ]}
                            status={shipment.stateCode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

