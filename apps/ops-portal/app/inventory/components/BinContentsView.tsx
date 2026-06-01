'use client';

import { useState, useEffect, useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { formatCompositeQuantity } from '@modbm/shared';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';

interface Location {
  locationId: string;
  code: string;
  name: string;
}

export default function BinContentsView() {
  const tCommon = useTranslations('common');
  const tBins = useTranslations('bins');
  const tInventory = useTranslations('inventory');

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationCode, setSelectedLocationCode] = useState<string | null>(null);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  // Load locations and resolve default
  useEffect(() => {
    api.inventoryControllerFindAllLocations({} )
      .then((response) => {
        const locs = response.data || [];
        setLocations(locs);
        
        if (locs.length > 0) {
          setSelectedLocationCode(locs[0].code);
        }
        setLocationsLoaded(true);
      })
      .catch((err) => {
        reportError(err, 'BinContentsView_Locations');
        setLocationsLoaded(true);
      });
  }, []);

  const binsEndpoint = useMemo(() => {
    if (!selectedLocationCode) return '/api/inventory/bins';
    return `/api/inventory/bins?locationNo=${encodeURIComponent(selectedLocationCode)}`;
  }, [selectedLocationCode]);

  const columns = useMemo<ColDef[]>(() => [
    { field: 'binNumber', headerName: tBins('columns.bin'), width: 120, pinned: 'left' },
    { field: 'zoneCode', headerName: tBins('columns.zone'), width: 100 },
    { field: 'locationName', headerName: tBins('columns.locationName'), width: 150 },
    { field: 'productNumber', headerName: tBins('columns.productNumber'), width: 130 },
    { field: 'productName', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'actualQuantity', headerName: tCommon('columns.qty'), width: 90, type: 'numericColumn' },
    { 
      headerName: 'Box Qty', 
      width: 130, 
      type: 'rightAligned',
      valueGetter: (params) => {
        if (!params.data || !params.data.actualQuantity) return '0';
        return formatCompositeQuantity(
          parseFloat(params.data.actualQuantity),
          params.data.productUoms || [],
          params.data.baseUom || 'EA'
        );
      }
    },
    { field: 'baseQuantity', headerName: tBins('columns.baseQty'), width: 100, type: 'numericColumn' },
    { field: 'isConsignment', headerName: tBins('columns.consignment'), width: 110 },
    { field: 'isBonded', headerName: tBins('columns.bonded'), width: 90 },
    { field: 'isUnavailable', headerName: tBins('columns.unavailable'), width: 110 },
    { field: 'binType', headerName: tBins('columns.binType'), width: 90 },
  ], [tCommon, tBins]);

  if (!locationsLoaded) return null;

  return (
    <>
      <DataGrid
        endpoint={binsEndpoint}
        columns={columns}
        gridKey="ops-bins"
        searchPlaceholder={tBins('placeholders.searchBins')}
        exportFileName="bins"
        fetchAll
        pageTitle={tInventory('tabs.binContents')}
        headerFilters={
          <select
            id="bin-contents-location-filter"
            value={selectedLocationCode ?? ''}
            onChange={(e) => setSelectedLocationCode(e.target.value || null)}
            className="input"
            style={{ width: '200px' }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.locationId} value={loc.code}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>
        }
      />
    </>
  );
}
