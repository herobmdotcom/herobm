'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { useSettings } from '@/components/SettingsProvider';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import DataGrid from '@/components/DataGrid';
import Link from 'next/link';
import ReceiveReturnSlideOver from './ReceiveReturnSlideOver';
import { RETURN_STATE } from '@herobm/shared';

function LocationFilter({ locations, selectedLocationId, setSelectedLocationId, tCommon }: { locations: api.InventoryLocationResponseDto[], selectedLocationId: string, setSelectedLocationId: (v: string) => void, tCommon: ReturnType<typeof useTranslations> }) {
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

export default function ReceivingReturnsPage() {
    const tCommon = useTranslations('common');
    useDocumentTitle('Customer Returns Queue');
    const [refreshKey, setRefreshKey] = useState(0);

    const { app } = useSettings();
    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId, locReady] = usePersistedSetting('receivingReturnsLocationId', 'UNSET');
    
    useEffect(() => {
        api.inventoryControllerFindAllLocations()
            .then(res => setLocations(res.data))
            .catch(reportError);
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
    const [selectedReturn, setSelectedReturn] = useState<Record<string, unknown> | null>(null);

    const handleReceive = useCallback((returnRecord: Record<string, unknown>) => {
        setSelectedReturn(returnRecord);
        setSlideOverOpen(true);
    }, []);

    const handleSlideOverClose = useCallback(() => {
        setSlideOverOpen(false);
        setSelectedReturn(null);
    }, []);

    const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // Fetch confirmed and partially received returns globally, filtered by location
    const gridEndpoint = `/api/sales-returns?stateCode=${RETURN_STATE.CONFIRMED},${RETURN_STATE.PARTIALLY_RECEIVED}${selectedLocationId && selectedLocationId !== 'UNSET' ? `&locationId=${selectedLocationId}` : ''}`;

    const gridColumns: Record<string, unknown>[] = useMemo(() => [
        { field: 'returnNumber', headerName: 'Return No', width: 140 },
        { field: 'orderNumber', headerName: 'Order No', width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 120, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { 
            field: 'lines', 
            headerName: 'Lines', 
            width: 100,
            cellRenderer: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => {
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

    const headerActions = (
        <LocationFilter 
            locations={locations} 
            selectedLocationId={selectedLocationId === 'UNSET' ? '' : selectedLocationId} 
            setSelectedLocationId={setSelectedLocationId} 
            tCommon={tCommon} 
        />
    );

    return (
        <>
            <DataGrid 
                refreshTrigger={refreshKey}
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="returns-receiving-list"
                fetchAll
                rowIdField="returnId"
                onRowClicked={handleReceive}
                pageTitle="Customer Returns"
                headerActions={headerActions}
            />
            
            <ReceiveReturnSlideOver 
                isOpen={slideOverOpen} 
                onClose={handleSlideOverClose} 
                returnRecord={selectedReturn} 
                onRefresh={triggerRefresh} 
            />
        </>
    );
}
