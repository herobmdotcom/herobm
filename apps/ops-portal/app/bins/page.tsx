'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'binNumber', headerName: 'Bin', width: 120 },
  { field: 'binType', headerName: 'Type', width: 90 },
  { field: 'locationName', headerName: 'Location', width: 140 },
  { field: 'productNumber', headerName: 'Product #', width: 130 },
  { field: 'productName', headerName: 'Product', flex: 1, minWidth: 200 },
  { field: 'actualQuantity', headerName: 'Qty', width: 90, type: 'numericColumn' },
  { field: 'isConsignment', headerName: 'Consignment', width: 110 },
  { field: 'isBonded', headerName: 'Bonded', width: 90 },
];

export default function BinsPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Bin Contents</h2>
      <DataGrid
        endpoint="/api/inventory/bins"
        columns={columns}
        searchPlaceholder="Search by bin number, product name, or product number…"
      />
    </Shell>
  );
}
