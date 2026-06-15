'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import Link from 'next/link';

interface ShipmentLine {
    shipmentLineId: string;
    salesOrderLineId: string;
    quantityShipped: string;
}

interface Shipment {
    shipmentId: string;
    shipmentNumber: string;
    stateCode: string;
    notes: string | null;
    trackingNumber: string | null;
    createdOn: string;
    createdBy: string;
    lines: ShipmentLine[];
}

interface Props {
    orderId: string;
}

export default function ShipmentsSection({ orderId }: Props) {
    const tShipping = useTranslations('shipping');
    const tCommon = useTranslations('common');

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.orderShipmentsControllerFindShipments(orderId)
            .then((res) => setShipments((res.data || []) as unknown as Shipment[]))
            .catch((err) => reportError(err, 'ShipmentsSection'))
            .finally(() => setLoading(false));
    }, [orderId]);

    return (
        <div id="shipments-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined">inventory_2</span>
                    {tShipping('shipmentsTitle')}
                </h3>
            </div>

            {loading ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('loading')}
                </div>
            ) : shipments.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {tShipping('noShipmentsFound')}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {shipments.map(shipment => (
                        <Link
                            key={shipment.shipmentId}
                            href={`/shipments/${shipment.shipmentId}`}
                            className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line i18next/no-literal-string */}
                                <span className="material-symbols-outlined text-[var(--text-muted)] text-lg">inventory_2</span>
                                <div>
                                    <div className="font-bold text-sm text-[var(--text-primary)]">{shipment.shipmentNumber}</div>
                                    <div className="text-xs text-[var(--text-muted)]">
                                        {new Date(shipment.createdOn).toLocaleDateString()} · {tShipping('shipmentLines', { count: shipment.lines.length })}
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
            )}
        </div>
    );
}
