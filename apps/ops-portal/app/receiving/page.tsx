'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { useSettings } from '@/components/SettingsProvider';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import POAllocationCell from './POAllocationCell';
import AllocationSlideOver, { GoodsReceivedLine } from './AllocationSlideOver';
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { GOODS_RECEIVED_STATE, PUTAWAY_STATUS, MATCH_STATUS } from '@herobm/shared';
import { getErrorMessage } from '@herobm/shared';
import QuarantineModal from './QuarantineModal';

interface ReceivingGridRow extends GoodsReceivedLine {
    goodsReceivedId?: string | null;
    stateCode?: string | null;
    createdOn?: string | number | null;
    orderNumber?: string | null;
    packingSlipNumber?: string | null;
    notes?: string | null;
}

function FilterDropdown({ locations, selectedLocationId, setSelectedLocationId, days, setDays, t, tCommon, defaultLocId }: { locations: api.InventoryLocationResponseDto[], selectedLocationId: string, setSelectedLocationId: (v: string) => void, days: string, setDays: (v: string) => void, t: ReturnType<typeof useTranslations>, tCommon: ReturnType<typeof useTranslations>, defaultLocId: string }) {
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
        <>
            <div className="hidden lg:flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">{tCommon('columns.location')}</label>
                    <select
                        value={selectedLocationId}
                        onChange={(e) => {
                            setSelectedLocationId(e.target.value);
                        }}
                        className="input text-sm w-48"
                    >
                        <option value="">{t('buttons.allLocations')}</option>
                        {locations.map((loc) => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {loc.code} - {loc.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">{tCommon('columns.date')}</label>
                    <select
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        className="input text-sm w-40"
                    >
                        <option value="30">{tCommon('filters.last30Days')}</option>
                        <option value="90">{tCommon('filters.last90Days')}</option>
                        <option value="365">{tCommon('filters.last1Year')}</option>
                        <option value="0">{tCommon('filters.allTime')}</option>
                    </select>
                </div>
            </div>

            <div className="lg:hidden sm:relative" ref={ref}>
                <button 
                    onClick={() => setOpen(!open)}
                    className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${isActive ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'}`}
                    title="Filters"
                >
                    { }
                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                </button>
                {open && (
                    <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-64 bg-white -[0_4px_24px_rgba(0,0,0,0.12)] rounded-xl border border-[var(--border)] p-4 z-50 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{tCommon('columns.location')}</label>
                            <select
                                value={selectedLocationId}
                                onChange={(e) => {
                                    setSelectedLocationId(e.target.value);
                                }}
                                className="input text-sm w-full"
                            >
                                <option value="">{t('buttons.allLocations')}</option>
                                {locations.map((loc) => (
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
        </>
    );
}

export default function GoodsReceivedListPage() {
    const t = useTranslations('goodsReceived');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const { app } = useSettings();
    const [days, setDays, isReadyDays] = usePersistedFilter('receiving-days', '90');
    const [refreshKey, setRefreshKey] = useState(0);

    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('receiving_selected_location', '');

    useEffect(() => {
        api.inventoryControllerFindAllLocations({} )
            .then((response) => {
                const locs = response.data || [];
                setLocations(locs);
            })
            .catch((err: unknown) => reportError(err, 'ReceivingPage.loadLocations'));
    }, []);

    useEffect(() => {
        if (locReady && locations.length > 0) {
            const isValidSaved = selectedLocationId && locations.some(l => l.locationId === selectedLocationId);
            const defaultLocId = isValidSaved ? selectedLocationId : (app?.defaultFulfillmentLocationId || locations[0].locationId);
            if (defaultLocId !== selectedLocationId) {
                setSelectedLocationId(defaultLocId as string);
            }
        }
    }, [locReady, locations, selectedLocationId, app?.defaultFulfillmentLocationId, setSelectedLocationId]);

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [quarantineModalOpen, setQuarantineModalOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState<ReceivingGridRow[]>([]);

    const handleAllocate = useCallback(() => {
        if (selectedRows.length === 0) return;
        setSlideOverOpen(true);
    }, [selectedRows]);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    const handleToggleQuarantine = useCallback(() => {
        if (selectedRows.length === 0) return;
        setQuarantineModalOpen(true);
    }, [selectedRows]);

    const handleQuarantineSubmit = useCallback(async (reason: string, targetBinId?: string) => {
        const eligible = selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED);
        const errors: string[] = [];
        for (const row of eligible) {
            try {
                await api.inventoryControllerQuarantineMove({
                    lineId: row.goodsReceivedLineId as string,
                    sourceType: 'goods_receipt',
                    quantity: (row.quantityReceived || '0') as string,
                    reason,
                    targetBinId
                });
                toast.success('Line quarantined successfully');
            } catch (err: unknown) {
                errors.push(getErrorMessage(err) || `Failed for ${row.receiptNumber}`);
            }
        }
        if (errors.length > 0) {
            alert(`Quarantine errors:\n${errors.join('\n')}`);
        }
        triggerRefresh();
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
            await api.goodsReceivedControllerCancelReception(receiptId as string, {});
            triggerRefresh();
            setSelectedRows([]);
        } catch (err: unknown) {
            alert(getErrorMessage(err) || 'Failed to cancel receipt');
        }
    }, [selectedRows, triggerRefresh]);

    const gridEndpoint = isReadyDays ? `/api/goods-received/lines?days=${days}&limit=0${selectedLocationId ? `&locationId=${selectedLocationId}` : ''}` : undefined;

    const gridColumns: ColDef<ReceivingGridRow>[] = useMemo(() => [
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
            valueFormatter: (p: ValueFormatterParams<ReceivingGridRow>) => {
                if (!p.value) return '';
                if (p.data?.stateCode === GOODS_RECEIVED_STATE.CANCELLED) return 'Cancelled';
                if (p.value === PUTAWAY_STATUS.COMPLETED) return 'Completed';
                if (p.value === PUTAWAY_STATUS.QUARANTINED) return 'Quarantined';
                if (p.value === PUTAWAY_STATUS.PENDING_PUTAWAY) return 'Pending';
                if (p.value === PUTAWAY_STATUS.AWAITING_MATCHING) return 'Awaiting Match';
                return p.value;
            }
        },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 110, 
            valueFormatter: (p: ValueFormatterParams<ReceivingGridRow>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { field: 'vendorName', headerName: t('columns.supplier'), width: 160 },
        { field: 'locationName', headerName: tCommon('columns.location'), width: 140 },
        { 
            field: 'productNumber', 
            headerName: tCommon('columns.product'), 
            width: 240,
            cellRenderer: (p: ICellRendererParams<ReceivingGridRow>) => {
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
            cellRenderer: (p: ICellRendererParams<ReceivingGridRow>) => <POAllocationCell data={p.data} />
        },

        { field: 'packingSlipNumber', headerName: t('columns.packingSlip'), width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [t, tCommon]);

    // Count unmatched (and not quarantined) in selection — quarantined items cannot be matched
    const matchableCount = selectedRows.filter((r) => r.matchStatus !== MATCH_STATUS.MATCHED && r.putawayStatus !== PUTAWAY_STATUS.QUARANTINED).length;
    const hasQuarantinedSelected = selectedRows.some((r) => r.putawayStatus === PUTAWAY_STATUS.QUARANTINED);
    const canQuarantine = selectedRows.filter(r => r.putawayStatus !== PUTAWAY_STATUS.COMPLETED).length > 0 && new Set(selectedRows.map(r => r.locationId as string)).size <= 1;

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
                    <Link href="/receiving/new" className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                        {t('buttons.newReception')}
                    </Link>
                }
                secondaryHeader={
                    <div className="flex items-center justify-start gap-3">
                        <button
                            onClick={handleToggleQuarantine}
                            disabled={!canQuarantine}
                            title={new Set(selectedRows.map(r => r.locationId as string)).size > 1 ? 'Cannot quarantine items from different locations at once' : undefined}
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

            <QuarantineModal
                isOpen={quarantineModalOpen}
                onClose={() => setQuarantineModalOpen(false)}
                onSubmit={handleQuarantineSubmit}
                locationId={selectedLocationId || (selectedRows.length > 0 ? selectedRows[0].locationId as string : '')}
            />
        </>
    );
}
