
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { RETURN_STATE } from '@herobm/shared';
import AdHocCreditNoteSlideOver from './AdHocCreditNoteSlideOver';
import ReturnCreditNoteSlideOver from './ReturnCreditNoteSlideOver';

export default function ReturnsQueuePage() {
    const tCommon = useTranslations('common');
    const tOrders = useTranslations('salesOrders');
    useDocumentTitle('Credit Notes Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const [adHocOpen, setAdHocOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<Record<string, unknown> | null>(null);

    const handleAdHocClose = useCallback(() => setAdHocOpen(false), []);
    
    const handleReturnClick = useCallback((returnRecord: Record<string, unknown>) => {
        setSelectedReturn(returnRecord);
    }, []);

    const handleReturnClose = useCallback(() => {
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch received returns waiting for a credit note
    const gridEndpoint = `/api/sales-returns?stateCode=${RETURN_STATE.RECEIVED}`;

    const gridColumns: Record<string, unknown>[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        {
            field: 'stateCode',
            headerName: tCommon('columns.status'),
            width: 120,
            valueGetter: (p: import("ag-grid-community").ValueGetterParams<Record<string, unknown>>) => p.data?.stateCode,
            valueFormatter: (p: import("ag-grid-community").ValueFormatterParams<Record<string, unknown>>) => {
                const val = p.value as string;
                if (!val) return '';
                return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
            }
        },
        {
            field: 'putawayStatus',
            headerName: 'Putaway',
            width: 130,
            valueGetter: (p: import("ag-grid-community").ValueGetterParams<Record<string, unknown>>) => {
                const lines = p.data?.lines as Array<{ putawayStatus?: string }> | undefined;
                if (!lines || lines.length === 0) return 'No items';
                const allCompleted = lines.every(l => l.putawayStatus === 'completed');
                return allCompleted ? 'Completed' : 'Pending';
            }
        },
        { 
            field: 'lines', 
            headerName: 'Lines', 
            width: 100,
            valueGetter: (p: import("ag-grid-community").ValueGetterParams<Record<string, unknown>>) => {
                const lines = p.data?.lines as Record<string, unknown>[];
                return lines ? lines.length : 0;
            },
            valueFormatter: (p: import("ag-grid-community").ValueFormatterParams<Record<string, unknown>>) => {
                if (!p.value) return '';
                return tCommon('itemsCount', { count: p.value });
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
                        className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 whitespace-nowrap" 
                        onClick={() => setAdHocOpen(true)}
                    >
                        + {tOrders('returns.creditNote')}
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
