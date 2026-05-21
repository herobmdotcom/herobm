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
    const [selectedReturn, setSelectedReturn] = useState<any>(null);

    const handleReceive = useCallback((returnRecord: any) => {
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

    const gridColumns: any[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { 
            field: 'lines', 
            headerName: 'Lines', 
            width: 100,
            cellRenderer: (p: any) => {
                if (!p.value) return null;
                return (
                    <span className="badge badge-sm badge-info">
                        {p.value.length} items
                    </span>
                );
            }
        },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [tCommon]);

    return (
        <>
            <div className="h-full flex flex-col relative p-4 lg:p-6">
                <div className="flex-1 min-h-0 flex flex-col z-10 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden transition-all">
                    <DataGrid 
                        refreshTrigger={refreshKey}
                        endpoint={gridEndpoint} 
                        columns={gridColumns} 
                        gridKey="returns-receiving-list"
                        fetchAll
                        rowIdField="returnId"
                        onRowClicked={handleReceive}
                        renderHeader={({ searchInput, rowCount, loading }) => (
                            <div className="flex flex-col gap-3 px-6 py-4 border-b border-[var(--border)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <h2 className="text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            Customer Returns
                                        </h2>
                                        <div className="h-5 w-px bg-[var(--border)] shrink-0 mx-2"></div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg shrink-0">
                                            <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                                {tCommon('grid.rowCountLabel')}
                                            </span>
                                            <span className="text-[11px] font-bold text-[var(--accent)]">
                                                {loading ? '...' : rowCount.toLocaleString()}
                                            </span>
                                        </div>
                                        
                                        <div className="flex-1 ml-4 max-w-md">
                                            {searchInput}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        <Link href="/receiving" className="btn btn-secondary btn-sm">
                                            Back to Receipts
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
            
            <ReceiveReturnSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                returnRecord={selectedReturn} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
