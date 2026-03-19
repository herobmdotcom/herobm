'use client';

import { useMemo } from 'react';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function InventoryPage() {
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
    <Shell>
      <h2 className="text-2xl font-bold mb-6">{tInventory('title')}</h2>
      <DataGrid
        endpoint="/api/inventory"
        columns={columns}
        gridKey="ops-inventory"
        searchPlaceholder={tInventory('placeholders.searchInventory')}
        exportFileName="inventory"
        fetchAll
      />
    </Shell>
  );
}
