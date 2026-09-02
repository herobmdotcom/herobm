'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { routes } from '@/lib/routes';

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
        api.transfersControllerFindShipments(orderId)
            .then((res) => setShipments((res.data || []) as unknown as Shipment[]))
            .catch((err) => reportError(err, 'ShipmentsSection'))
            .finally(() => setLoading(false));
    }, [orderId]);

    return (
        <div id="shipments-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    { }
                    <span className="material-symbols-outlined">inventory_2</span>
                    {tShipping('shipmentsTitle')}
                </h3>
            </div>

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
                                tShipping('shipmentLines', { count: shipment.lines?.length || 0 }),
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
