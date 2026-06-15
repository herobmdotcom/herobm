'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import * as api from '@herobm/sdk';
import Link from 'next/link';

/**
 * FulfillmentSection — Combined read-only picking + shipping status
 * for the Sales Order detail page. Single table showing the full
 * fulfillment pipeline per line: Ordered → Picked → Shipped → Available.
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

interface PickingSummaryLine {
    salesOrderLineId: string;
    lineNumber: number;
    productId: string;
    productNumber: string;
    productDescription: string;
    quantity: string;
    quantityPicked: string;
    remaining: string;
    isFullyPicked: boolean;
    isPhysical: boolean;
    onHand: string;
}

interface PickingSummary {
    totalLines: number;
    fullyPickedLines: number;
    isFullyPicked: boolean;
    lines: PickingSummaryLine[];
}

interface Props {
    orderId: string;
    pickingSummary: PickingSummary | null;
    order: import('./types').OrderDetail;
}

export default function FulfillmentSection({ orderId, pickingSummary, order }: Props) {
    const t = useTranslations('fulfillment');
    const tCommon = useTranslations('common');

    const [shippingCtx, setShippingCtx] = useState<ShippingContext | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.orderPickingControllerGetShippingContext(orderId)
            .then((res) => setShippingCtx(res.data as unknown as ShippingContext))
            .catch(() => setShippingCtx(null))
            .finally(() => setLoading(false));
    }, [orderId]);

    const pickingMap = new Map(
        (pickingSummary?.lines ?? []).map(l => [l.salesOrderLineId, l])
    );

    const physicalLines = (shippingCtx?.lines ?? []).filter(l => l.isPhysical);

    return (
        <div id="fulfillment-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">local_shipping</span>
                    {t('title')}
                </h3>
            </div>

            {loading ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('loading')}
                </div>
            ) : !shippingCtx ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('noData')}
                </div>
            ) : (
                <>

                    <DataTable
                        data={physicalLines}
                        keyExtractor={(line) => line.salesOrderLineId}
                        columns={[
                            { header: t('columns.product') },
                            { header: t('columns.ordered'), align: 'right' },
                            { header: t('columns.picked'), align: 'right' },
                            { header: t('columns.onHand'), align: 'right' },
                            { header: t('columns.shipped'), align: 'right' },
                            { header: t('columns.readyToShip'), align: 'right' }
                        ]}
                        emptyMessage={t('noPhysicalLines')}
                        renderCustomRow={(line: ShippingLine, idx: number) => {
                            const ordered = parseFloat(line.quantity);
                            const picked = parseFloat(line.quantityPicked);
                            const shipped = parseFloat(line.quantityShipped);
                            const available = parseFloat(line.availableToShip);
                            const pickLine = pickingMap.get(line.salesOrderLineId);
                            const onHand = pickLine ? parseFloat(pickLine.onHand) : null;
                            const isPicked = picked >= ordered;
                            const isShipped = shipped >= ordered;

                            return (
                                <tr key={line.salesOrderLineId} className={isShipped ? 'opacity-50' : ''}>
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
                                        <span className={isPicked ? 'text-[var(--success)]' : picked > 0 ? 'text-[var(--warning)]' : ''}>
                                            {picked.toLocaleString()}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                        {onHand !== null ? onHand.toLocaleString() : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        <span className={isShipped ? 'text-[var(--success)]' : shipped > 0 ? 'text-[var(--warning)]' : ''}>
                                            {shipped.toLocaleString()}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        <span className={available > 0 ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
                                            {available.toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            );
                        }}
                        mobileCard={(line: ShippingLine) => {
                            const ordered = parseFloat(line.quantity);
                            const picked = parseFloat(line.quantityPicked);
                            const shipped = parseFloat(line.quantityShipped);
                            const available = parseFloat(line.availableToShip);
                            const pickLine = pickingMap.get(line.salesOrderLineId);
                            const onHand = pickLine ? parseFloat(pickLine.onHand) : null;
                            const isPicked = picked >= ordered;
                            const isShipped = shipped >= ordered;

                            return (
                                <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col ${isShipped ? 'opacity-60' : ''}`}>
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="font-semibold text-sm text-[var(--accent)]">
                                            {line.productId ? (
                                                <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                    {line.productNumber}
                                                </Link>
                                            ) : line.productNumber}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium mb-3">
                                        {line.productDescription}
                                    </div>
                                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                        <MobileCardField label={t('columns.ordered')} value={
                                            <span className="font-semibold">{ordered.toLocaleString()}</span>
                                        } />
                                        <MobileCardField label={t('columns.picked')} value={
                                            <span className={isPicked ? 'text-[var(--success)] font-semibold' : picked > 0 ? 'text-[var(--warning)] font-semibold' : ''}>
                                                {picked.toLocaleString()}
                                            </span>
                                        } />
                                        <MobileCardField label={t('columns.onHand')} value={
                                            <span className="text-[var(--text-muted)]">
                                                {onHand !== null ? onHand.toLocaleString() : '—'}
                                            </span>
                                        } />
                                        <MobileCardField label={t('columns.shipped')} value={
                                            <span className={isShipped ? 'text-[var(--success)] font-semibold' : shipped > 0 ? 'text-[var(--warning)] font-semibold' : ''}>
                                                {shipped.toLocaleString()}
                                            </span>
                                        } />
                                        <MobileCardField label={t('columns.readyToShip')} value={
                                            <span className={available > 0 ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
                                                {available.toLocaleString()}
                                            </span>
                                        } />
                                    </div>
                                </div>
                            );
                        }}
                    />

                </>
            )}
        </div>
    );
}
