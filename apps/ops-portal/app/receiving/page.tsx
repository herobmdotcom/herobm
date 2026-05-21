'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSettings } from '@/components/SettingsProvider';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import POAllocationCell from './POAllocationCell';
import AllocationSlideOver from './AllocationSlideOver';
import { GOODS_RECEIVED_STATE, PUTAWAY_STATUS, MATCH_STATUS } from '@modbm/shared';

export default function GoodsReceivedListPage() {
    const t = useTranslations('goodsReceived');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const { app } = useSettings();
    const [days, setDays] = useState('90');
    const [refreshKey, setRefreshKey] = useState(0);

    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');

    useEffect(() => {
        apiFetch<any>('/api/inventory/locations')
            .then(response => {
                const locs = response.data || [];
                setLocations(locs);
                // For receiving, we default to the app default but allow "All" (which is empty string)
                const defaultLocId = app?.defaultFulfillmentLocationId || (locs.length > 0 ? locs[0].locationId : '');
                setSelectedLocationId(defaultLocId);
            })
            .catch(err => reportError(err, 'GoodsReceivedListPage.loadLocations'));
    }, [app?.defaultFulfillmentLocationId]);

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
            const reason = window.prompt('Reason for quarantine', '') || undefined;

            // Toggle for all selected that are not completed
            const eligible = selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED);
            const errors: string[] = [];
            for (const row of eligible) {
                try {
                    await apiMutate(`/api/goods-received/lines/${row.goodsReceivedLineId}/quarantine`, 'POST', { reason });
                } catch (err: any) {
                    errors.push(err.message || `Failed for ${row.receiptNumber}`);
                }
            }
            if (errors.length > 0) {
                alert(`Quarantine errors:\n${errors.join('\n')}`);
            }
            triggerRefresh();
        } catch (err: any) {
            alert(err.message || 'Failed to toggle quarantine');
        }
    }, [selectedRows, triggerRefresh]);

    const handleCancelReceipt = useCallback(async () => {
        const uniqueReceiptIds = [...new Set(selectedRows.map((r) => r.goodsReceivedId))];
        if (uniqueReceiptIds.length !== 1) {
            alert('Please select lines from exactly one receipt to cancel.');
            return;
        }

        const receiptId = uniqueReceiptIds[0];
        const receiptNumber = selectedRows.find(r => r.goodsReceivedId === receiptId)?.receiptNumber;

        if (!window.confirm(`Are you sure you want to cancel the ENTIRE receipt ${receiptNumber}? This cannot be undone.`)) {
            return;
        }

        try {
            await apiMutate(`/api/goods-received/${receiptId}/cancel`, 'POST');
            triggerRefresh();
            setSelectedRows([]);
        } catch (err: any) {
            alert(err.message || 'Failed to cancel receipt');
        }
    }, [selectedRows, triggerRefresh]);

    const gridEndpoint = `/api/goods-received/lines?days=${days}&limit=0${selectedLocationId ? `&locationId=${selectedLocationId}` : ''}`;

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
                let badgeClass = 'badge-secondary';
                let label = p.value;
                if (p.data?.stateCode === GOODS_RECEIVED_STATE.CANCELLED) { badgeClass = 'badge-cancelled'; label = 'Cancelled'; }
                else if (p.value === PUTAWAY_STATUS.COMPLETED) { badgeClass = 'badge-success'; label = 'Completed'; }
                else if (p.value === PUTAWAY_STATUS.QUARANTINED) { badgeClass = 'badge-danger'; label = 'Quarantined'; }
                else if (p.value === PUTAWAY_STATUS.PENDING_PUTAWAY) { badgeClass = 'badge-info'; label = 'Pending'; }
                else if (p.value === PUTAWAY_STATUS.AWAITING_MATCHING) { badgeClass = 'badge-warning'; label = 'Awaiting Match'; }
                
                return (
                    <span className={`badge badge-sm ${badgeClass}`}>
                        {label}
                    </span>
                );
            }
        },
        { field: 'packingSlipNumber', headerName: t('columns.packingSlip'), width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [t, tCommon]);

    // Count unmatched (and not quarantined) in selection — quarantined items cannot be matched
    const matchableCount = selectedRows.filter((r) => r.matchStatus !== MATCH_STATUS.MATCHED && r.putawayStatus !== PUTAWAY_STATUS.QUARANTINED).length;
    const hasQuarantinedSelected = selectedRows.some((r) => r.putawayStatus === PUTAWAY_STATUS.QUARANTINED);

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
                                            value={selectedLocationId}
                                            onChange={(e) => setSelectedLocationId(e.target.value)}
                                            className="input text-sm"
                                            style={{ minWidth: 180 }}
                                        >
                                            <option value="">All locations</option>
                                            {locations.map(loc => (
                                                <option key={loc.locationId} value={loc.locationId}>
                                                    {loc.code} - {loc.name}
                                                </option>
                                            ))}
                                        </select>
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
                                    
                                    {/* Group 2: Quarantine & Cancel */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleToggleQuarantine}
                                            disabled={selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED).length === 0}
                                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            Quarantine
                                        </button>
                                        <button
                                            onClick={handleCancelReceipt}
                                            disabled={[...new Set(selectedRows.map(r => r.goodsReceivedId))].length !== 1 || selectedRows.some(r => r.putawayStatus === PUTAWAY_STATUS.COMPLETED)}
                                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            title="Cancel the entire receipt for the selected lines"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>

                                    {/* Group 3: Match */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleAllocate}
                                            disabled={matchableCount === 0}
                                            title={hasQuarantinedSelected ? 'Quarantined items must be cleared before matching' : undefined}
                                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                            Match{matchableCount > 0 ? ` (${matchableCount})` : ''}
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
