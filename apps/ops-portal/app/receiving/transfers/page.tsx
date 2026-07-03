'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { useSettings } from '@/components/SettingsProvider';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import DataGrid from '@/components/DataGrid';
import ReceiveTransferSlideOver from './ReceiveTransferSlideOver';
import { TRANSFER_ORDER_STATE } from '@herobm/shared';

function LocationFilter({ locations, selectedLocationId, setSelectedLocationId, t, tCommon, defaultLocId }: { locations: api.InventoryLocationResponseDto[], selectedLocationId: string, setSelectedLocationId: (v: string) => void, t: ReturnType<typeof useTranslations>, tCommon: ReturnType<typeof useTranslations>, defaultLocId: string }) {
    return (
        <div className="flex items-center gap-2">
            <select
                value={selectedLocationId}
                onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                }}
                className="input text-sm w-48"
            >
                <option value="">{tCommon('filters.allLocations')}</option>
                {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                        {loc.code} - {loc.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function ReceivingTransfersPage() {
    const tCommon = useTranslations('common');
    const t = useTranslations('transfers');
    useDocumentTitle('Incoming Transfers');
    const { app } = useSettings();
    const [refreshKey, setRefreshKey] = useState(0);

    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('receiving_selected_location', 'UNSET');

    useEffect(() => {
        api.inventoryControllerFindAllLocations({})
            .then((response) => {
                const locs = response.data || [];
                setLocations(locs);
            })
            .catch((err: unknown) => reportError(err, 'ReceivingTransfersPage.loadLocations'));
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

    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<Record<string, unknown> | null>(null);

    const handleReceive = useCallback((transferRecord: Record<string, unknown>) => {
        setSelectedTransfer(transferRecord);
        setSlideOverOpen(true);
    }, []);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
        setSelectedTransfer(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    const gridEndpoint = locReady ? `/api/transfers?state=${TRANSFER_ORDER_STATE.SHIPPED}${selectedLocationId && selectedLocationId !== 'UNSET' ? `&destinationLocationId=${selectedLocationId}` : ''}` : undefined;

    const gridColumns: Record<string, unknown>[] = useMemo(() => [
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'sourceLocationName', headerName: 'Source', width: 180 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { field: 'createdBy', headerName: 'Created By', width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ], [tCommon]);

    return (
        <>
            <DataGrid 
                refreshTrigger={refreshKey}
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="transfers-receiving-list"
                fetchAll
                rowIdField="transferOrderId"
                onRowClicked={handleReceive}
                pageTitle="Incoming Transfers"
                headerActions={
                    <LocationFilter 
                        locations={locations} 
                        selectedLocationId={selectedLocationId === 'UNSET' ? '' : (selectedLocationId as string)} 
                        setSelectedLocationId={setSelectedLocationId} 
                        t={t} 
                        tCommon={tCommon} 
                        defaultLocId={app?.defaultFulfillmentLocationId as string} 
                    />
                }
            />
            
            <ReceiveTransferSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                transferRecord={selectedTransfer} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
