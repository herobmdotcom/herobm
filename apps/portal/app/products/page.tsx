'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'productNumber', headerName: 'Product #', width: 130, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'productGroupName', headerName: 'Group', width: 160 },
  { field: 'standardCost', headerName: 'Std Cost', width: 100, type: 'numericColumn' },
  { field: 'quantityOnHand', headerName: 'On Hand', width: 100, type: 'numericColumn' },
  { field: 'quantityAvailable', headerName: 'Available', width: 100, type: 'numericColumn' },
  { field: 'barcode', headerName: 'Barcode', width: 130 },
  { field: 'stateCode', headerName: 'Status', width: 90 },
];

export default function ProductsPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Products</h2>
      <DataGrid
        endpoint="/api/products"
        columns={columns}
        searchPlaceholder="Search by name, product number, or barcode…"
        exportFileName="products"
      />
    </Shell>
  );
}
