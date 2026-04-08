'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import StateBadge from '@/components/StateBadge';
import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
import { ValidState } from '@/types/states';
import Link from 'next/link';

export default function GlobalReceptionsPage() {
    const t = useTranslations('purchaseOrders');
    const tCommon = useTranslations('common');
    useDocumentTitle('Receiving');
    const router = useRouter();
    const [days, setDays] = useState('90');

    const handleRowClicked = useCallback((row: any) => {
        if (row.purchaseOrderId) {
            router.push(`/purchase-orders/${row.purchaseOrderId}?source=app#details-section`);
        }
    }, [router]);

    const gridEndpoint = `/api/receptions?days=${days}&limit=0`;
    
    const gridColumns: any[] = [
        { field: 'receptionId', headerName: 'ID', hide: true },
        { field: 'receptionNumber', headerName: 'Reception No.', width: 160 },
        { field: 'purchaseOrderNumber', headerName: 'Purchase Order No.', width: 180 },
        { field: 'createdOn', headerName: 'Date', width: 140, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'packingSlipNumber', headerName: 'Packing Slip', width: 160 },
        { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 200 },
        { 
            field: 'stateCode', 
            headerName: 'State', 
            width: 140,
            cellRenderer: (params: { value: string }) => {
                if (!params.value) return null;
                return <StateBadge state={params.value as ValidState} />;
            }
        },
    ];

    return (
        <>
            <div className="h-full flex flex-col relative p-4 lg:p-6">
                <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
                    <DataGrid 
                        endpoint={gridEndpoint} 
                        columns={gridColumns} 
                        gridKey="global-receptions"
                        fetchAll
                        rowIdField="receptionId"
                        onRowClicked={handleRowClicked}
                        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                            <div className="flex items-center justify-between px-6 py-4">
                                <div className="flex items-center gap-4 flex-1">
                                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                        Receiving
                                    </h2>
                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            {tCommon('grid.rowCountLabel')}
                                        </span>
                                        <span className="text-[11px] font-bold text-[#006b5c]">
                                            {loading ? '...' : rowCount.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 ml-4 max-w-md">
                                        {searchInput}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <select
                                        value={days}
                                        onChange={(e) => setDays(e.target.value)}
                                        className="input text-sm"
                                        style={{ minWidth: 150 }}
                                    >
                                        <option value="30">{tCommon('filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
                                        <option value="90">{tCommon('filters.last90Days', { defaultValue: 'Last 90 Days' })}</option>
                                        <option value="365">{tCommon('filters.last1Year', { defaultValue: 'Last 1 Year' })}</option>
                                        <option value="0">{tCommon('filters.allTime', { defaultValue: 'All Time' })}</option>
                                    </select>
                                    {optionsButton}
                                    <Link href="/receiving/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                                      Receive Goods
                                    </Link>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
        </>
    );
}
