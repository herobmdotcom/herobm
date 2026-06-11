'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import ReceiveReturnSlideOver from './ReceiveReturnSlideOver';
import { RETURN_STATE } from '@modbm/shared';

export default function ReceivingReturnsPage() {
    const tCommon = useTranslations('common');
    useDocumentTitle('Customer Returns Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<Record<string, unknown> | null>(null);

    const handleReceive = useCallback((returnRecord: Record<string, unknown>) => {
        setSelectedReturn(returnRecord);
        setSlideOverOpen(true);
    }, []);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch confirmed and partially received returns globally
    const gridEndpoint = `/api/sales-returns?stateCode=${RETURN_STATE.CONFIRMED},${RETURN_STATE.PARTIALLY_RECEIVED}`;

    const gridColumns: Record<string, unknown>[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { 
            field: 'lines', 
            headerName: 'Lines', 
            width: 100,
            cellRenderer: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => {
                if (!p.value) return null;
                return (
                    <span className="badge badge-sm badge-info">
                        {tCommon('itemsCount', { count: p.value.length })}
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
                gridKey="returns-receiving-list"
                fetchAll
                rowIdField="returnId"
                onRowClicked={handleReceive}
                pageTitle="Customer Returns"
            />
            
            <ReceiveReturnSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                returnRecord={selectedReturn} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
