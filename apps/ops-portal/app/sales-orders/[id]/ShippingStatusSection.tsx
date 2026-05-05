'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

/**
 * ShippingStatusSection — Read-only shipping status for the Sales Order detail page.
 * Fetches the shipping context and shows shipped quantities per line
 * plus a summary of existing shipments.
 */

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

interface Props {
    orderId: string;
}

export default function ShippingStatusSection({ orderId }: Props) {
    const tShipping = useTranslations('shipping');
    const tCommon = useTranslations('common');

    const [context, setContext] = useState<ShippingContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        apiFetch<ShippingContext>(`/api/sales-orders/${orderId}/shipping-context`)
            .then(setContext)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [orderId]);

    if (loading) {
        return (
            <div id="shipping-section" className="card">
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('loading')}
                </div>
            </div>
        );
    }

    if (error || !context) {
        return (
            <div id="shipping-section" className="card">
                <div className="text-center py-6 text-sm" style={{ color: 'var(--danger)' }}>
                    {error || tShipping('errors.failedToLoadContext')}
                </div>
            </div>
        );
    }

    const physicalLines = context.lines.filter(l => l.isPhysical);
    const fullyShippedLines = physicalLines.filter(l => parseFloat(l.availableToShip) <= 0 && parseFloat(l.quantityShipped) > 0).length;
    const isFullyShipped = physicalLines.length > 0 && fullyShippedLines === physicalLines.length;

    return (
        <div id="shipping-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    <span className="material-symbols-outlined">local_shipping</span>
                    {tShipping('title')}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {fullyShippedLines} / {physicalLines.length}
                    </span>
                    {isFullyShipped && (
                        <span className="text-xs font-bold text-[var(--success)]">
                            <span className="material-symbols-outlined text-sm align-middle mr-0.5">check_circle</span>
                            Fully Shipped
                        </span>
                    )}
                </div>
            </div>

            {/* Lines Table */}
            <table className="table-lines">
                <thead>
                    <tr>
                        <th>{tShipping('columns.product')}</th>
                        <th style={{ textAlign: 'right' }}>{tShipping('columns.ordered')}</th>
                        <th style={{ textAlign: 'right' }}>{tShipping('columns.picked')}</th>
                        <th style={{ textAlign: 'right' }}>{tShipping('columns.shipped')}</th>
                        <th style={{ textAlign: 'right' }}>{tShipping('columns.available')}</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {physicalLines.map(line => {
                        const shipped = parseFloat(line.quantityShipped);
                        const available = parseFloat(line.availableToShip);
                        const ordered = parseFloat(line.quantity);
                        const fullyShipped = shipped >= ordered;

                        return (
                            <tr key={line.salesOrderLineId} className={fullyShipped ? 'opacity-60' : ''}>
                                <td>
                                    <div className="font-bold text-sm">
                                        {line.productId ? (
                                            <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                {line.productNumber}
                                            </Link>
                                        ) : line.productNumber}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">{line.productDescription}</div>
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {ordered.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {parseFloat(line.quantityPicked).toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {shipped.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    <span className={available > 0 ? 'font-semibold text-[var(--success)]' : 'text-[var(--text-muted)]'}>
                                        {available.toLocaleString()}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {fullyShipped ? (
                                        <span className="material-symbols-outlined text-[var(--success)] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    ) : available > 0 ? (
                                        <span className="material-symbols-outlined text-[var(--warning)] text-base">pending</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-[var(--text-muted)] text-base">hourglass_empty</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {physicalLines.length === 0 && (
                        <tr>
                            <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-muted)]">
                                No physical lines.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Existing Shipments */}
            {context.shipments.length > 0 && (
                <div className="mt-6">
                    <h4 className="section-heading !mb-3 !text-[var(--text-muted)]">{tShipping('existingShipments')}</h4>
                    <div className="flex flex-col gap-2">
                        {context.shipments.map(shipment => (
                            <Link
                                key={shipment.shipmentId}
                                href={`/shipments/${shipment.shipmentId}`}
                                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[var(--text-muted)] text-lg">inventory_2</span>
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-primary)]">{shipment.shipmentNumber}</div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {new Date(shipment.createdOn).toLocaleDateString()} · {tShipping('shipmentLines', { count: shipment.lineCount })}
                                            {shipment.trackingNumber && (
                                                <span> · {shipment.trackingNumber}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <StateBadge state={shipment.stateCode as ValidState} />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {context.shipments.length === 0 && (
                <div className="mt-4 text-center text-sm text-[var(--text-muted)] py-2">
                    {tShipping('noShipmentsYet')}
                </div>
            )}
        </div>
    );
}
