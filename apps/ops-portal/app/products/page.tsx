'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'productNumber', headerName: 'Product #', width: 130, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'scNumber', headerName: 'SC Number', width: 140 },
  { field: 'productGroupName', headerName: 'Group', width: 160 },
  { field: 'defaultVendorName', headerName: 'Default Vendor', width: 160, hide: true },
  { field: 'standardCost', headerName: 'Std Cost', width: 100, type: 'numericColumn',
    valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'listPrice', headerName: 'List Price', width: 110, type: 'numericColumn',
    valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'tradePrice', headerName: 'Trade Price', width: 110, type: 'numericColumn',
    valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'priceLevel3', headerName: 'Level 3', width: 100, type: 'numericColumn', hide: true,
    valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'priceLevel4', headerName: 'Level 4', width: 100, type: 'numericColumn', hide: true,
    valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
  { field: 'barcode', headerName: 'Barcode', width: 130 },
  { field: 'gstCategory', headerName: 'GST Category', width: 120, hide: true },
  { field: 'stateCode', headerName: 'Status', width: 90 },
  { field: 'notes', headerName: 'Notes', width: 150, hide: true },
  { field: 'createdBy', headerName: 'Created By', width: 120, hide: true },
  {
    field: 'createdOn',
    headerName: 'Created',
    width: 110,
    hide: true,
    valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
  },
  {
    field: 'source',
    headerName: 'Source',
    width: 90,
    hide: true,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      const label = params.value === 'abm' ? 'ABM' : 'App';
      return <span className={`badge badge-${params.value}`}>{label}</span>;
    },
  },
];

export default function ProductsPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Products</h2>
        <Link href="/products/new" className="btn btn-secondary btn-sm">
          + Add Product
        </Link>
      </div>
      <DataGrid
        endpoint="/api/products"
        columns={columns}
        gridKey="ops-products"
        searchPlaceholder="Search by name, product number, or barcode…"
        exportFileName="products"
        fetchAll
        onRowClicked={(row: any) => router.push(`/products/${row.productId}`)}
      />
    </Shell>
  );
}
