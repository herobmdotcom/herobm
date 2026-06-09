/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { RETURN_STATE } from '@modbm/shared';
import AdHocCreditNoteSlideOver from './AdHocCreditNoteSlideOver';
import ReturnCreditNoteSlideOver from './ReturnCreditNoteSlideOver';

export default function ReturnsQueuePage() {
    const tCommon = useTranslations('common');
    useDocumentTitle('Credit Notes Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const [adHocOpen, setAdHocOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<Record<string, unknown> | null>(null);

    const handleAdHocClose = useCallback(() => setAdHocOpen(false), []);
    
    const handleReturnClick = useCallback((returnRecord: any) => {
        setSelectedReturn(returnRecord);
    }, []);

    const handleReturnClose = useCallback(() => {
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch received returns waiting for a credit note
    const gridEndpoint = `/api/sales-returns?stateCode=${RETURN_STATE.RECEIVED}`;

    const gridColumns: any[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<any>) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { 
            field: 'lines', 
            headerName: 'Lines', 
            width: 100,
            cellRenderer: (p: import("ag-grid-community").ICellRendererParams<any>) => {
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
                gridKey="credit-notes-queue-list"
                rowIdField="returnId"
                onRowClicked={handleReturnClick}
                pageTitle="Credit Notes Queue"
                headerActions={
                    <button 
                        className="btn btn-primary shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" 
                        onClick={() => setAdHocOpen(true)}
                    >
                        <span className="material-symbols-outlined text-[1.1rem]">add</span>
                        Credit Note
                    </button>
                }
            />

            <AdHocCreditNoteSlideOver 
                isOpen={adHocOpen} 
                onClose={handleAdHocClose} 
                onSuccess={() => {
                    handleAdHocClose();
                    triggerRefresh();
                }} 
            />

            <ReturnCreditNoteSlideOver
                isOpen={!!selectedReturn}
                onClose={handleReturnClose}
                returnRecord={selectedReturn}
                onSuccess={() => {
                    handleReturnClose();
                    triggerRefresh();
                }}
            />
        </>
    );
}
