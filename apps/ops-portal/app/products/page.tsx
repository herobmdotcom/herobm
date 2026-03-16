'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'productNumber', headerName: 'Product #', width: 130, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'scNumber', headerName: 'SC Number', width: 140 },
  { field: 'productGroupName', headerName: 'Group', width: 160 },
  { field: 'standardCost', headerName: 'Std Cost', width: 100, type: 'numericColumn',
    valueFormatter: (p) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'listPrice', headerName: 'List Price', width: 110, type: 'numericColumn',
    valueFormatter: (p) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'tradePrice', headerName: 'Trade Price', width: 110, type: 'numericColumn',
    valueFormatter: (p) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'priceLevel3', headerName: 'Level 3', width: 100, type: 'numericColumn',
    valueFormatter: (p) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'priceLevel4', headerName: 'Level 4', width: 100, type: 'numericColumn',
    valueFormatter: (p) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
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
        gridKey="ops-products"
        searchPlaceholder="Search by name, product number, or barcode…"
        exportFileName="products"
      />
    </Shell>
  );
}
