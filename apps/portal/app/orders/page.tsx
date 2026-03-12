'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'orderReference', headerName: 'Order #', width: 150, pinned: 'left' },
  { field: 'documentDate', headerName: 'Date', width: 110, valueFormatter: (p: { value: unknown }) => { if (!p.value) return ''; return new Date(p.value as string).toLocaleDateString(); } },
  { field: 'customerOrderNumber', headerName: 'Customer PO', width: 140 },
  { field: 'accountName', headerName: 'Customer', flex: 1, minWidth: 180 },
  { field: 'productNumber', headerName: 'Product #', width: 120 },
  { field: 'productDescription', headerName: 'Description', flex: 1, minWidth: 180 },
  { field: 'quantity', headerName: 'Qty', width: 80, type: 'numericColumn' },
  { field: 'documentTotalExTax', headerName: 'Total (ex tax)', width: 120, type: 'numericColumn' },
  { field: 'documentTotalTax', headerName: 'Tax', width: 90, type: 'numericColumn' },
  { field: 'documentTotalIncTax', headerName: 'Total (inc tax)', width: 120, type: 'numericColumn' },
];

export default function OrdersPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Orders</h2>
      <DataGrid
        endpoint="/api/orders"
        columns={columns}
        searchPlaceholder="Search by order number, customer, or product…"
        exportFileName="orders"
      />
    </Shell>
  );
}
