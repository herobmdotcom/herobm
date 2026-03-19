'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function ProductsPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'productNumber', headerName: tProducts('columns.productNumber'), width: 130, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'scNumber', headerName: tProducts('columns.scNumber'), width: 140 },
    { field: 'productGroupName', headerName: tCommon('columns.group'), width: 160 },
    { field: 'defaultVendorName', headerName: tProducts('columns.vendor'), width: 160, hide: true },
    { field: 'standardCost', headerName: tProducts('columns.stdCost'), width: 100, type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'listPrice', headerName: tProducts('columns.listPrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'tradePrice', headerName: tProducts('columns.tradePrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'priceLevel3', headerName: tProducts('columns.priceLevel3'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'priceLevel4', headerName: tProducts('columns.priceLevel4'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: any) => p.value && parseFloat(p.value) > 0 ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'barcode', headerName: tProducts('columns.barcode'), width: 130 },
    { field: 'gstCategory', headerName: tProducts('columns.gstCategory'), width: 120, hide: true },
    { field: 'stateCode', headerName: tCommon('columns.status'), width: 90 },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120, hide: true },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
    {
      field: 'source',
      headerName: tCommon('columns.source'),
      width: 90,
      hide: true,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        const label = params.value === 'abm' ? tCommon('sources.abm') : tCommon('sources.app');
        return <span className={`badge badge-${params.value}`}>{label}</span>;
      },
    },
  ], [tCommon, tProducts]);

  return (
    <Shell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{tProducts('title')}</h2>
        <Link href="/products/new" className="btn btn-secondary btn-sm">
          {tProducts('buttons.addProduct')}
        </Link>
      </div>
      <DataGrid
        endpoint="/api/products"
        columns={columns}
        gridKey="ops-products"
        searchPlaceholder={tProducts('placeholders.searchProducts')}
        exportFileName="products"
        fetchAll
        showArchivedToggle
        onRowClicked={(row: any) => router.push(`/products/${row.productId}`)}
      />
    </Shell>
  );
}
