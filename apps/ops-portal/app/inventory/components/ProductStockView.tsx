'use client';

import { useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function ProductStockView() {
  const tCommon = useTranslations('common');
  const tInventory = useTranslations('inventory');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'productNumber', headerName: tInventory('columns.productNumber'), width: 130, pinned: 'left' },
    { field: 'productName', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'scNumber', headerName: tInventory('columns.scNumber'), width: 140 },
    { field: 'locationNo', headerName: tInventory('columns.locationNo'), width: 110, hide: true },
    { field: 'locationName', headerName: tCommon('columns.city'), width: 140 }, // Using city for locationName
    { field: 'quantityOnHand', headerName: tCommon('columns.onHand'), width: 100, type: 'numericColumn' },
    { field: 'quantityCommitted', headerName: tCommon('columns.committed'), width: 110, type: 'numericColumn' },
    { field: 'quantityAvailable', headerName: tCommon('columns.available'), width: 100, type: 'numericColumn' },
    { field: 'quantityOnOrder', headerName: tCommon('columns.ordered'), width: 100, type: 'numericColumn' },
    { field: 'quantityReserved', headerName: tCommon('columns.reserved'), width: 100, type: 'numericColumn' },
    { field: 'quantityBackOrdered', headerName: tInventory('columns.backOrdered'), width: 120, type: 'numericColumn', hide: true },
    { field: 'minQuantity', headerName: tInventory('columns.minQty'), width: 90, type: 'numericColumn', hide: true },
    { field: 'maxQuantity', headerName: tInventory('columns.maxQty'), width: 90, type: 'numericColumn', hide: true },
    { field: 'defaultBinNumber', headerName: tInventory('columns.defaultBin'), width: 110 },
    { field: 'valueOnHand', headerName: tInventory('columns.value'), width: 100, type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? p.value.toLocaleString(undefined, { style: 'currency', currency: 'EUR' }) : '—' },
    { field: 'lastInUnitCost', headerName: tInventory('columns.lastCost'), width: 110, type: 'numericColumn', hide: true,
      valueFormatter: (p: any) => p.value ? p.value.toLocaleString(undefined, { style: 'currency', currency: 'EUR' }) : '—' },
  ], [tCommon, tInventory]);

  return (
    <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
      <DataGrid
        endpoint="/api/inventory"
        columns={columns}
        gridKey="ops-inventory"
        searchPlaceholder={tInventory('placeholders.searchInventory')}
        exportFileName="inventory"
        fetchAll
        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {tInventory('tabs.products')}
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
              {optionsButton}
            </div>
          </div>
        )}
      />
    </div>
  );
}
