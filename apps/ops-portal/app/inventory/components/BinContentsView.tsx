'use client';

import { useState, useEffect, useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef, ValueGetterParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { formatCompositeQuantity } from '@herobm/shared';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import MoveStockModal from '../bins/MoveStockModal';
import AdjustStockModal from '../bins/AdjustStockModal';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';

interface Location {
  locationId: string;
  code: string;
  name: string;
}

interface BinContentRow {
  binContentId: string;
  binId: string;
  binNumber: string;
  zoneCode: string;
  locationNo: string;
  locationName: string;
  productId: string;
  productNumber: string;
  productName: string;
  actualQuantity: string;
  productUoms: unknown[];
  baseUom: string;
  baseQuantity: number;
  isConsignment: boolean;
  isBonded: boolean;
  isUnavailable: boolean;
  binType: string;
}

export default function BinContentsView() {
  const tCommon = useTranslations('common');
  const tBins = useTranslations('bins');
  const tInventory = useTranslations('inventory');

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationCode, setSelectedLocationCode] = useState<string | null>(null);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [selectedRows, setSelectedRows] = useState<BinContentRow[]>([]);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    { field: 'productNumber', headerName: tBins('columns.productNumber'), width: 130, valueFormatter: (params) => params.value || '—' },
    { field: 'productName', headerName: tCommon('columns.name'), flex: 1, minWidth: 200, valueFormatter: (params) => params.value || '—' },
    { field: 'actualQuantity', headerName: tCommon('columns.qty'), width: 90, type: 'numericColumn' },
    { 
      headerName: 'Box Qty', 
      width: 130, 
      type: 'rightAligned',
      valueGetter: (params: ValueGetterParams<BinContentRow>) => {
        if (!params.data || !params.data.actualQuantity) return '0';
        return formatCompositeQuantity(
          parseFloat(params.data.actualQuantity),
          (params.data.productUoms || []) as any[] /* eslint-disable-line @typescript-eslint/no-explicit-any -- DTO typing does not exactly match frontend local definitions */,
          params.data.baseUom || 'EA'
        );
      }
    },
    { field: 'baseQuantity', headerName: tBins('columns.baseQty'), width: 100, type: 'numericColumn' },
    { field: 'isConsignment', headerName: tBins('columns.consignment'), width: 110, valueFormatter: (params) => params.value ? 'true' : 'false' },
    { field: 'isBonded', headerName: tBins('columns.bonded'), width: 90, valueFormatter: (params) => params.value ? 'true' : 'false' },
    { field: 'isUnavailable', headerName: tBins('columns.unavailable'), width: 110, valueFormatter: (params) => params.value ? 'true' : 'false' },
    { field: 'binType', headerName: tBins('columns.binType'), width: 90 },
  ], [tCommon, tBins]);

  const handleSelectionChanged = (rows: BinContentRow[]) => {
    setSelectedRows(rows);
  };

  const selectedLocationId = useMemo(() => {
    if (selectedRows.length === 0) return null;
    return selectedRows[0].locationNo;
  }, [selectedRows]);

  const canMove = selectedRows.length > 0 && selectedRows.every(r => r.locationNo === selectedLocationId);

  const handleMoveSubmit = async (
    lines: { productId: string; sourceBinId: string; targetBinId: string; quantity: string }[],
    reason: string
  ) => {
    try {
      await api.inventoryControllerMoveStock({
        lines,
        reason
      });
      toast.success('Stock moved successfully');
      setRefreshKey(prev => prev + 1);
      setSelectedRows([]);
    } catch (err) {
      reportError(err, 'BinContentsView.moveStock');
      throw err;
    }
  };

  const handleAdjustSubmit = async (
    lines: { productId: string; sourceBinId: string; quantity: string }[],
    reason: string
  ) => {
    try {
      await api.inventoryControllerAdjustStock({
        lines: lines.map(l => ({
          productId: l.productId,
          binId: l.sourceBinId,
          newQuantity: l.quantity.toString()
        })),
        reason
      });
      toast.success('Stock adjusted successfully');
      setRefreshKey(prev => prev + 1);
      setSelectedRows([]);
    } catch (err) {
      reportError(err, 'BinContentsView.adjustStock');
      throw err;
    }
  };

  if (!locationsLoaded) return null;

  return (
    <>
      <DataGrid<BinContentRow>
        endpoint={binsEndpoint}
        columns={columns}
        gridKey={`ops-bins-${refreshKey}`}
        rowIdField="binContentId"
        rowSelection="multiple"
        onSelectionChanged={handleSelectionChanged}
        searchPlaceholder={tBins('placeholders.searchBins')}
        exportFileName="bins"
        fetchAll
        pageTitle={tInventory('tabs.binContents')}
        defaultSortModel={[{ colId: 'binNumber', sort: 'asc' }]}
        headerActions={
          <div className="flex items-center">
            {selectedRows.length > 0 && !canMove && (
              <span className="text-xs text-red-500 mr-3 hidden sm:inline-block">
                {tCommon('cannotMoveCrossLocation')}
              </span>
            )}
            <Button
              variant="secondary"
              className="mr-2"
              disabled={selectedRows.length === 0}
              onClick={() => setIsAdjustModalOpen(true)}
            >
              {tCommon('adjustStock')}
            </Button>
            <Button
              variant="primary"
              disabled={!canMove}
              onClick={() => setIsMoveModalOpen(true)}
            >
              {tCommon('moveStock')}
            </Button>
          </div>
        }
        headerFilters={
          <select
            id="bin-contents-location-filter"
            value={selectedLocationCode ?? ''}
            onChange={(e) => setSelectedLocationCode(e.target.value || null)}
            className="input w-[200px]"
          >
            { }
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.locationId} value={loc.code}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>
        }
      />
      
      <MoveStockModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        onSubmit={handleMoveSubmit}
        selectedLines={selectedRows.map(r => ({
          productId: r.productId,
          productName: r.productName,
          sourceBinId: r.binId,
          sourceBinNumber: r.binNumber,
          quantity: parseFloat(r.actualQuantity),
          locationNo: r.locationNo
        }))}
      />
      
      <AdjustStockModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onSubmit={handleAdjustSubmit}
        selectedLines={selectedRows.map(r => ({
          productId: r.productId,
          productName: r.productName,
          sourceBinId: r.binId,
          sourceBinNumber: r.binNumber,
          quantity: parseFloat(r.actualQuantity),
          locationNo: r.locationNo
        }))}
      />
    </>
  );
}
