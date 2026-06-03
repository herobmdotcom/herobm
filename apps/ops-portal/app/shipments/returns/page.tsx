'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import ShipReturnSlideOver from './ShipReturnSlideOver';
import { PURCHASE_RETURN_STATE } from '@modbm/shared';

export default function ShipmentsReturnsPage() {
    const tCommon = useTranslations('common');
    const tPurchase = useTranslations('purchaseOrders');
    useDocumentTitle('Supplier Returns Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    // modbm-allow-record-any
  const [selectedReturn, setSelectedReturn] = useState<Record<string, any> | null>(null);

    const handleShip = useCallback((returnRecord: any) => {
        setSelectedReturn(returnRecord);
        setSlideOverOpen(true);
    }, []);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch DRAFT and STAGED returns globally
    const gridEndpoint = `/api/purchase-returns?stateCode=${PURCHASE_RETURN_STATE.DRAFT},${PURCHASE_RETURN_STATE.STAGED}`;

    const gridColumns: any[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'PO No', width: 140 },
        { field: 'vendorName', headerName: 'Supplier', flex: 1 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { 
            field: 'stateCode', 
            headerName: 'Status', 
            width: 120,
            cellRenderer: (p: any) => {
                if (!p.value) return null;
                const stateColors: any = {
                    [PURCHASE_RETURN_STATE.DRAFT]: 'badge-warning',
                    [PURCHASE_RETURN_STATE.STAGED]: 'badge-info',
                };
                return (
                    <span className={`badge badge-sm ${stateColors[p.value] || 'badge-neutral'}`}>
                        {p.value.toUpperCase()}
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
                  returnRecord={selectedReturn as any} 
                  onRefresh={triggerRefresh} 
              />
            )}
        </>
    );
}
