'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSettings } from '@/components/SettingsProvider';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import UnquarantineModal from './UnquarantineModal';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';

function FilterDropdown({ locations, selectedLocationId, setSelectedLocationId, t, tCommon, defaultLocId }: { locations: api.InventoryLocationResponseDto[], selectedLocationId: string, setSelectedLocationId: (v: string) => void, t: ReturnType<typeof useTranslations>, tCommon: ReturnType<typeof useTranslations>, defaultLocId: string }) {
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

    const isActive = selectedLocationId !== defaultLocId;

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
                    </div>
                )}
            </div>
        </>
    );
}

export default function QuarantineListPage() {
    const t = useTranslations('goodsReceived');
    const tCommon = useTranslations('common');
    useDocumentTitle('Quarantined Inventory');
    const { app } = useSettings();
    const [refreshKey, setRefreshKey] = useState(0);

    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('receiving_selected_location', 'UNSET');
    const [selectedLocationNo, setSelectedLocationNo] = useState<string>('');

    useEffect(() => {
        api.inventoryControllerFindAllLocations({} )
            .then((response) => {
                const locs = response.data || [];
                setLocations(locs);
            })
            .catch((err: unknown) => reportError(err, 'QuarantineListPage.loadLocations'));
    }, []);

    useEffect(() => {
        if (locReady && locations.length > 0) {
            if (selectedLocationId === 'UNSET') {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId as string);
            } else if (selectedLocationId !== '' && !locations.some(l => l.locationId === selectedLocationId)) {
                const defaultLocId = app?.defaultFulfillmentLocationId || locations[0].locationId;
                setSelectedLocationId(defaultLocId as string);
            }
        }
    }, [locReady, locations, selectedLocationId, app?.defaultFulfillmentLocationId, setSelectedLocationId]);

    useEffect(() => {
        if (selectedLocationId) {
            const loc = locations.find(l => l.locationId === selectedLocationId);
            setSelectedLocationNo(loc ? loc.code : '');
        } else {
            setSelectedLocationNo('');
        }
    }, [selectedLocationId, locations]);

    const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
    const [unquarantineModalOpen, setUnquarantineModalOpen] = useState(false);

    const hasMultipleLocations = new Set(selectedRows.map(r => r.locationNo)).size > 1;

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    const handleToggleUnquarantine = useCallback(() => {
        if (selectedRows.length === 0) return;
        setUnquarantineModalOpen(true);
    }, [selectedRows]);

    const handleUnquarantineSubmit = useCallback(async (reason: string, targetBinId: string) => {
        if (!targetBinId) return;
        
        const errors: string[] = [];
        for (const row of selectedRows) {
            try {
                await api.inventoryControllerQuarantineMove({
                    sourceBinId: row.binId as string,
                    productId: row.productId as string,
                    quantity: (row.actualQuantity || '0') as string,
                    reason,
                    targetBinId,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
                    sourceType: 'manual' as any
                });
                toast.success('Line unquarantined successfully');
            } catch (err: unknown) {
                errors.push(row.productNumber as string);
            }
        }
        if (errors.length > 0) {
            alert(`Failed to unquarantine the following products: ${errors.join(', ')}`);
        }
        triggerRefresh();
        setSelectedRows([]);
    }, [selectedRows, triggerRefresh]);

    const gridEndpoint = `/api/inventory/bins?binType=quarantine&limit=0${selectedLocationNo ? `&locationNo=${selectedLocationNo}` : ''}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const gridColumns: any[] = useMemo(() => [
        { field: 'binContentId', headerName: tCommon('columns.id'), hide: true },
        { 
            field: 'productNumber', 
            headerName: tCommon('columns.product'), 
            width: 140,
            checkboxSelection: true,
            headerCheckboxSelection: true
        },
        { field: 'productName', headerName: tCommon('columns.description'), width: 240 },
        { field: 'locationName', headerName: tCommon('columns.location'), width: 140 },
        { field: 'zoneCode', headerName: 'Zone', width: 120 },
        { field: 'binNumber', headerName: 'Bin', width: 120 },
        { 
            field: 'actualQuantity', 
            headerName: tCommon('columns.quantity'), 
            width: 120,
            cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            valueFormatter: (p: import("ag-grid-community").ICellRendererParams<any>) => {
                return `${p.value} ${p.data?.baseUom || ''}`;
            }
        }
    ], [tCommon]);

    return (
        <>
            <DataGrid 
                refreshTrigger={refreshKey}
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="quarantine-inventory-list"
                defaultSortModel={[
                    { colId: 'productNumber', sort: 'asc' }
                ]}
                fetchAll
                rowIdField="binContentId"
                rowSelection="multiple"
                onSelectionChanged={setSelectedRows}
                pageTitle="Quarantined Inventory"
                headerFilters={
                    <FilterDropdown 
                        locations={locations}
                        selectedLocationId={selectedLocationId === 'UNSET' ? '' : selectedLocationId}
                        setSelectedLocationId={setSelectedLocationId}
                        t={t}
                        tCommon={tCommon}
                        defaultLocId={app?.defaultFulfillmentLocationId || ''}
                    />
                }
                headerActions={
                    <div className="flex lg:hidden flex-wrap items-center justify-start gap-3 w-full">
                        <button
                            onClick={handleToggleUnquarantine}
                            disabled={selectedRows.length === 0 || hasMultipleLocations}
                            title={hasMultipleLocations ? 'Cannot unquarantine items from multiple locations at once' : ''}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {t('buttons.unquarantine')}
                        </button>
                    </div>
                }
                secondaryHeader={
                    <div className="flex flex-wrap items-center justify-start gap-3">
                        <button
                            onClick={handleToggleUnquarantine}
                            disabled={selectedRows.length === 0 || hasMultipleLocations}
                            title={hasMultipleLocations ? 'Cannot unquarantine items from multiple locations at once' : ''}
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {t('buttons.unquarantine')}
                        </button>
                    </div>
                }
            />

            <UnquarantineModal
                isOpen={unquarantineModalOpen}
                onClose={() => setUnquarantineModalOpen(false)}
                onSubmit={handleUnquarantineSubmit}
                locationId={(selectedLocationId === 'UNSET' ? '' : selectedLocationId) || (selectedRows.length > 0 ? locations.find(l => l.code === selectedRows[0].locationNo)?.locationId || '' : '')}
            />
        </>
    );
}
