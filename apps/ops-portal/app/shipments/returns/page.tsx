'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import ShipReturnSlideOver, { ShipReturnSlideOverProps } from './ShipReturnSlideOver';
import { PURCHASE_RETURN_STATE } from '@herobm/shared';

export default function ShipmentsReturnsPage() {
    const tCommon = useTranslations('common');
    const tPurchase = useTranslations('purchaseOrders');
    useDocumentTitle('Supplier Returns Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<ShipReturnSlideOverProps['returnRecord'] | null>(null);

    const handleShip = useCallback((returnRecord: Record<string, unknown>) => {
        setSelectedReturn(returnRecord as unknown as ShipReturnSlideOverProps['returnRecord']);
        setSlideOverOpen(true);
    }, []);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch DRAFT and STAGED returns globally
    const gridEndpoint = `/api/purchase-returns?stateCode=${PURCHASE_RETURN_STATE.DRAFT},${PURCHASE_RETURN_STATE.STAGED}`;

    const gridColumns: Record<string, unknown>[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'PO No', width: 140 },
        { field: 'vendorName', headerName: 'Supplier', flex: 1 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { 
            field: 'stateCode', 
            headerName: 'Status', 
            width: 120,
            cellRenderer: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => {
                if (!p.value) return null;
                const stateColors: Record<string, string> = {
                    [PURCHASE_RETURN_STATE.DRAFT]: 'badge-warning',
                    [PURCHASE_RETURN_STATE.STAGED]: 'badge-info',
                };
                return (
                    <span className={`badge badge-sm ${stateColors[p.value as string] || 'badge-neutral'}`}>
                        {(p.value as string).toUpperCase()}
                    </span>
                );
            }
        },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [tCommon]);

    return (
        <>
            <DataGrid 
                refreshTrigger={refreshKey}
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="returns-shipment-list"
                fetchAll
                rowIdField="returnId"
                onRowClicked={handleShip}
                pageTitle="Supplier Returns Queue"
            />
            
            {slideOverOpen && (
              <ShipReturnSlideOver 
                  isOpen={slideOverOpen} 
                  onClose={handleSlideOverClose} 
                  returnRecord={selectedReturn!} 
                  onRefresh={triggerRefresh} 
              />
            )}
        </>
    );
}
