'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'productNumber', headerName: 'Product #', width: 130, pinned: 'left' },
  { field: 'productName', headerName: 'Product', flex: 1, minWidth: 200 },
  { field: 'scNumber', headerName: 'SC Number', width: 140 },
  { field: 'locationNo', headerName: 'Location No', width: 110, hide: true },
  { field: 'locationName', headerName: 'Location', width: 140 },
  { field: 'quantityOnHand', headerName: 'On Hand', width: 100, type: 'numericColumn' },
  { field: 'quantityCommitted', headerName: 'Committed', width: 110, type: 'numericColumn' },
  { field: 'quantityAvailable', headerName: 'Available', width: 100, type: 'numericColumn' },
  { field: 'quantityOnOrder', headerName: 'On Order', width: 100, type: 'numericColumn' },
  { field: 'quantityReserved', headerName: 'Reserved', width: 100, type: 'numericColumn' },
  { field: 'quantityBackOrdered', headerName: 'Back Ordered', width: 120, type: 'numericColumn', hide: true },
  { field: 'minQuantity', headerName: 'Min Qty', width: 90, type: 'numericColumn', hide: true },
  { field: 'maxQuantity', headerName: 'Max Qty', width: 90, type: 'numericColumn', hide: true },
  { field: 'defaultBinNumber', headerName: 'Default Bin', width: 110 },
  { field: 'valueOnHand', headerName: 'Value', width: 100, type: 'numericColumn',
    valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'lastInUnitCost', headerName: 'Last In Cost', width: 110, type: 'numericColumn', hide: true,
    valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
];

export default function InventoryPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Inventory</h2>
      <DataGrid
        endpoint="/api/inventory"
        columns={columns}
        gridKey="ops-inventory"
        searchPlaceholder="Search by product name, number, or location…"
        exportFileName="inventory"
        fetchAll
      />
    </Shell>
  );
}
