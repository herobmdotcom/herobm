'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSettings } from '@/components/SettingsProvider';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import toast from 'react-hot-toast';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import POAllocationCell from './POAllocationCell';
import AllocationSlideOver from './AllocationSlideOver';
import { GOODS_RECEIVED_STATE, PUTAWAY_STATUS, MATCH_STATUS } from '@modbm/shared';
import { getErrorMessage } from '@modbm/shared';

function FilterDropdown({ locations, selectedLocationId, setSelectedLocationId, days, setDays, t, tCommon, defaultLocId }: any) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isActive = selectedLocationId !== defaultLocId || days !== '90';

    return (
        <div className="sm:relative" ref={ref}>
            <button 
                onClick={() => setOpen(!open)}
                className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${isActive ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white lg:bg-transparent border border-[var(--border)] lg:border-none text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'}`}
                title="Filters"
            >
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
            {open && (
                <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-64 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-xl border border-[var(--border)] p-4 z-50 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{tCommon('columns.location')}</label>
                        <select
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                            className="input text-sm w-full"
                        >
                            <option value="">{t('buttons.allLocations')}</option>
                            {locations.map((loc: any) => (
                                <option key={loc.locationId} value={loc.locationId}>
                                    {loc.code} - {loc.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{tCommon('columns.date')}</label>
                        <select
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            className="input text-sm w-full"
                        >
                            <option value="30">{tCommon('filters.last30Days')}</option>
                            <option value="90">{tCommon('filters.last90Days')}</option>
                            <option value="365">{tCommon('filters.last1Year')}</option>
                            <option value="0">{tCommon('filters.allTime')}</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

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
        api.inventoryControllerFindAllLocations({} )
            .then((response) => {
                const locs = response.data || [];
                setLocations(locs);
                // For receiving, we default to the app default but allow "All" (which is empty string)
                const defaultLocId = app?.defaultFulfillmentLocationId || (locs.length > 0 ? locs[0].locationId : '');
                setSelectedLocationId(defaultLocId);
            })
            .catch((err: any) => reportError(err, 'GoodsReceivedListPage.loadLocations'));
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
                    if (reason) {
                        await api.inventoryControllerToggleQuarantine(row.goodsReceivedLineId, { reason } as unknown as import('@modbm/sdk').ToggleQuarantineDto);
                        toast.success('Line quarantined successfully');
                    }
                } catch (err: unknown) {
                    errors.push(getErrorMessage(err) || `Failed for ${row.receiptNumber}`);
                }
            }
            if (errors.length > 0) {
                alert(`Quarantine errors:\n${errors.join('\n')}`);
            }
            triggerRefresh();
        } catch (err: unknown) {
            alert(getErrorMessage(err) || 'Failed to toggle quarantine');
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
            await api.goodsReceivedControllerCancelReception(receiptId, {});
            triggerRefresh();
            setSelectedRows([]);
        } catch (err: unknown) {
            alert(getErrorMessage(err) || 'Failed to cancel receipt');
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
        {
            field: 'putawayStatus',
            headerName: 'Putaway Status',
            width: 140,
            valueFormatter: (p: any) => {
                if (!p.value) return '';
                if (p.data?.stateCode === GOODS_RECEIVED_STATE.CANCELLED) return 'Cancelled';
                if (p.value === PUTAWAY_STATUS.COMPLETED) return 'Completed';
                if (p.value === PUTAWAY_STATUS.QUARANTINED) return 'Quarantined';
                if (p.value === PUTAWAY_STATUS.PENDING_PUTAWAY) return 'Pending';
                if (p.value === PUTAWAY_STATUS.AWAITING_MATCHING) return 'Awaiting Match';
                return p.value;
            }
        },
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

        { field: 'packingSlipNumber', headerName: t('columns.packingSlip'), width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [t, tCommon]);

    // Count unmatched (and not quarantined) in selection — quarantined items cannot be matched
    const matchableCount = selectedRows.filter((r) => r.matchStatus !== MATCH_STATUS.MATCHED && r.putawayStatus !== PUTAWAY_STATUS.QUARANTINED).length;
    const hasQuarantinedSelected = selectedRows.some((r) => r.putawayStatus === PUTAWAY_STATUS.QUARANTINED);

    return (
        <>
            <DataGrid 
                refreshTrigger={refreshKey}
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="goods-received-lines-list"
                defaultSortModel={[
                    { colId: 'putawayStatus', sort: 'asc' },
                    { colId: 'createdOn', sort: 'desc' }
                ]}
                fetchAll
                rowIdField="goodsReceivedLineId"
                rowSelection="multiple"
                onSelectionChanged={setSelectedRows}
                pageTitle={t('title')}
                headerFilters={
                    <FilterDropdown 
                        locations={locations}
                        selectedLocationId={selectedLocationId}
                        setSelectedLocationId={setSelectedLocationId}
                        days={days}
                        setDays={setDays}
                        t={t}
                        tCommon={tCommon}
                        defaultLocId={app?.defaultFulfillmentLocationId || ''}
                    />
                }
                headerActions={
                    <div className="flex lg:hidden flex-wrap items-center justify-start gap-3 w-full">
                        <Link href="/receiving/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                            {t('buttons.newReception')}
                        </Link>
                        <button
                            onClick={handleToggleQuarantine}
                            disabled={selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED).length === 0}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {t('buttons.quarantine')}
                        </button>
                        <button
                            onClick={handleCancelReceipt}
                            disabled={[...new Set(selectedRows.map(r => r.goodsReceivedId))].length !== 1 || selectedRows.some(r => r.putawayStatus === PUTAWAY_STATUS.COMPLETED)}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            title={t('buttons.cancelReceiptTooltip')}
                        >
                            {t('buttons.cancel')}
                        </button>
                        <button
                            onClick={handleAllocate}
                            disabled={matchableCount === 0}
                            title={hasQuarantinedSelected ? 'Quarantined items must be cleared before matching' : undefined}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {matchableCount > 0 ? t('buttons.matchCount', { count: matchableCount }) : t('buttons.match')}
                        </button>
                    </div>
                }
                secondaryHeader={
                    <div className="flex flex-wrap items-center justify-end gap-3 w-full pt-3">
                        <Link href="/receiving/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                            {t('buttons.newReception')}
                        </Link>
                        <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                        <button
                            onClick={handleToggleQuarantine}
                            disabled={selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED).length === 0}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {t('buttons.quarantine')}
                        </button>
                        <button
                            onClick={handleCancelReceipt}
                            disabled={[...new Set(selectedRows.map(r => r.goodsReceivedId))].length !== 1 || selectedRows.some(r => r.putawayStatus === PUTAWAY_STATUS.COMPLETED)}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            title={t('buttons.cancelReceiptTooltip')}
                        >
                            {t('buttons.cancel')}
                        </button>
                        <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                        <button
                            onClick={handleAllocate}
                            disabled={matchableCount === 0}
                            title={hasQuarantinedSelected ? 'Quarantined items must be cleared before matching' : undefined}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {matchableCount > 0 ? t('buttons.matchCount', { count: matchableCount }) : t('buttons.match')}
                        </button>
                    </div>
                }
            />
            
            <AllocationSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                grLines={selectedRows} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
