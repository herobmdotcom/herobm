'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'productNumber', headerName: 'Product #', width: 130, pinned: 'left' },
  { field: 'productName', headerName: 'Product', flex: 1, minWidth: 200 },
  { field: 'locationName', headerName: 'Location', width: 140 },
  { field: 'quantityOnHand', headerName: 'On Hand', width: 100, type: 'numericColumn' },
  { field: 'quantityCommitted', headerName: 'Committed', width: 110, type: 'numericColumn' },
  { field: 'quantityAvailable', headerName: 'Available', width: 100, type: 'numericColumn' },
  { field: 'quantityOnOrder', headerName: 'On Order', width: 100, type: 'numericColumn' },
  { field: 'quantityReserved', headerName: 'Reserved', width: 100, type: 'numericColumn' },
  { field: 'defaultBinNumber', headerName: 'Default Bin', width: 110 },
  { field: 'valueOnHand', headerName: 'Value', width: 100, type: 'numericColumn' },
];

export default function InventoryPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Inventory</h2>
      <DataGrid
        endpoint="/api/inventory"
        columns={columns}
        searchPlaceholder="Search by product name, number, or location…"
        exportFileName="inventory"
      />
    </Shell>
  );
}
