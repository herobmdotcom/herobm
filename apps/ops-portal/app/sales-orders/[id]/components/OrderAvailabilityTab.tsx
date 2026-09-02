'use client';

import { AvailabilityTab } from '@/components/shared/AvailabilityTab';
import type { OrderDetail, InventoryLevel } from '../types';

interface OrderAvailabilityTabProps {
    order: OrderDetail;
    inventoryData: InventoryLevel[];
    inventoryLoading: boolean;
    gapMap: Record<string, import('@herobm/shared').InventoryGap>;
    activeBackorders: Set<string>;
    editFulfillmentLocationId: string | null;
    isPreConfirmation: boolean;
    isShipped: boolean;
}

export function OrderAvailabilityTab({
    order,
    inventoryData,
    inventoryLoading,
    gapMap,
    activeBackorders,
    editFulfillmentLocationId,
    isPreConfirmation,
    isShipped,
}: OrderAvailabilityTabProps) {
    return (
        <AvailabilityTab
            lines={order.lines || []}
            inventoryData={inventoryData as unknown as import('@/components/shared/AvailabilityTab').AvailabilityInventoryLevel[]}
            inventoryLoading={inventoryLoading}
            targetLocationId={editFulfillmentLocationId || order.fulfillmentLocationId}
            context="sales"
            gapMap={gapMap}
            activeBackorders={activeBackorders}
            isPreConfirmation={isPreConfirmation}
            isShipped={isShipped}
        />
    );
}

export default OrderAvailabilityTab;
