'use client';

import { useState, useEffect, useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { formatCompositeQuantity } from '@modbm/shared';
import { apiFetch, reportError } from '@/lib/api';

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
    apiFetch<{ data: Location[]; defaultFulfillmentLocationId?: string }>('/api/inventory/locations')
      .then((res) => {
        setLocations(res.data);
        if (res.defaultFulfillmentLocationId) {
          const defaultLoc = res.data.find((l) => l.locationId === res.defaultFulfillmentLocationId);
          setSelectedLocationCode(defaultLoc?.code ?? res.data[0]?.code ?? null);
        } else if (res.data.length > 0) {
          setSelectedLocationCode(res.data[0].code);
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
    <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
      <DataGrid
        endpoint={binsEndpoint}
        columns={columns}
        gridKey="ops-bins"
        searchPlaceholder={tBins('placeholders.searchBins')}
        exportFileName="bins"
        fetchAll
        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {tInventory('tabs.binContents')}
              </h2>
              <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>

              {/* Location filter */}
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
              {optionsButton}
            </div>
          </div>
        )}
      />
    </div>
  );
}
