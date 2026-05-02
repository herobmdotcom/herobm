'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import POAllocationCell from './POAllocationCell';
import AllocationSlideOver from './AllocationSlideOver';

export default function GoodsReceivedListPage() {
    const t = useTranslations('goodsReceived');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const [days, setDays] = useState('90');
    const [refreshKey, setRefreshKey] = useState(0);

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState<any[]>([]);

    const handleAllocate = useCallback(() => {
        if (selectedRows.length === 0) return;
        setSlideOverOpen(true);
    }, [selectedRows]);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    const handleToggleQuarantine = useCallback(async () => {
        if (selectedRows.length === 0) return;
        
        try {
            // Toggle for all selected that are not completed
            const eligible = selectedRows.filter(r => r.putawayStatus !== 'completed');
            for (const row of eligible) {
                await fetch(`/api/goods-received/quarantine/${row.goodsReceivedLineId}`, {
                    method: 'POST',
                });
            }
            triggerRefresh();
        } catch (err) {
            console.error('Failed to toggle quarantine', err);
        }
    }, [selectedRows, triggerRefresh]);

    const gridEndpoint = `/api/goods-received/lines?days=${days}&limit=0`;

    const gridColumns: any[] = useMemo(() => [
        {
            field: 'receiptNumber',
            headerName: t('columns.receiptNo'),
            width: 140,
            checkboxSelection: true,
            headerCheckboxSelection: true,
        },
        { field: 'goodsReceivedLineId', headerName: tCommon('columns.id'), hide: true },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 110, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'vendorName', headerName: t('columns.supplier'), width: 160 },
        { field: 'locationName', headerName: tCommon('columns.location', { defaultValue: 'Location' }), width: 140 },
        { 
            field: 'productNumber', 
            headerName: tCommon('columns.product'), 
            width: 240,
            cellRenderer: (p: any) => {
                if (!p.data) return null;
                return (
                    <div style={{ lineHeight: '1.2', padding: '4px 0' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.data.productNumber}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.data.productName}</div>
                    </div>
                );
            }
        },
        { 
            field: 'quantityReceived', 
            headerName: tCommon('columns.quantity'), 
            width: 90,
            cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
        },
        {
            field: 'orderNumber',
            headerName: 'PO Match',
            width: 220,
            cellRenderer: (p: any) => <POAllocationCell data={p.data} />
        },
        {
            field: 'putawayStatus',
            headerName: 'Putaway Status',
            width: 140,
            cellRenderer: (p: any) => {
                if (!p.value) return null;
                let bg = 'bg-gray-100 text-gray-700';
                let label = p.value;
                if (p.value === 'completed') { bg = 'bg-green-100 text-green-800'; label = 'Completed'; }
                else if (p.value === 'quarantined') { bg = 'bg-red-100 text-red-800'; label = 'Quarantined'; }
                else if (p.value === 'pending_putaway') { bg = 'bg-blue-100 text-blue-800'; label = 'Pending'; }
                
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
                        {label}
                    </span>
                );
            }
        },
        { field: 'packingSlipNumber', headerName: t('columns.packingSlip'), width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [t, tCommon]);

    // Count unmatched in selection
    const unmatchedCount = selectedRows.filter((r) => r.matchStatus !== 'matched').length;

    return (
        <>
            <div className="h-full flex flex-col relative p-4 lg:p-6">
                <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
                    <DataGrid 
                        refreshTrigger={refreshKey}
                        endpoint={gridEndpoint} 
                        columns={gridColumns} 
                        gridKey="goods-received-lines-list"
                        fetchAll
                        rowIdField="goodsReceivedLineId"
                        rowSelection="multiple"
                        onSelectionChanged={setSelectedRows}
                        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                            <div className="flex flex-col gap-3 px-6 py-4">
                                {/* First Row: Title, Filters, Search, Options */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* eslint-disable-next-line i18next/no-literal-string */}
                                        <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            {t('title')}
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
                                            <option value="30">{tCommon('filters.last30Days')}</option>
                                            <option value="90">{tCommon('filters.last90Days')}</option>
                                            <option value="365">{tCommon('filters.last1Year')}</option>
                                            <option value="0">{tCommon('filters.allTime')}</option>
                                        </select>
                                        {optionsButton}
                                    </div>
                                </div>

                                {/* Second Row: Action Buttons */}
                                <div className="flex items-center justify-end gap-4 pt-1">
                                    {/* Group 1: Receive Goods */}
                                    <div className="flex items-center">
                                        <Link href="/receiving/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                                            {t('buttons.newReception')}
                                        </Link>
                                    </div>
                                    
                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                                    
                                    {/* Group 2: Quarantine */}
                                    <div className="flex items-center">
                                        <button
                                            onClick={handleToggleQuarantine}
                                            disabled={selectedRows.filter(r => r.putawayStatus !== 'completed').length === 0}
                                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            Quarantine
                                        </button>
                                    </div>

                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>

                                    {/* Group 3: Match */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleAllocate}
                                            disabled={unmatchedCount === 0}
                                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                            Match{unmatchedCount > 0 ? ` (${unmatchedCount})` : ''}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
            
            <AllocationSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                grLines={selectedRows} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
