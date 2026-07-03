'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import type { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';


export default function ProductsContent() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products');
  const tStates = useTranslations('common.states');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'productNumber', headerName: tProducts('columns.productNumber'), width: 130, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'alternateProductNumber', headerName: tProducts('columns.alternateProductNumber'), width: 140 },
    { 
      field: 'productType', 
      headerName: 'Type', 
      width: 120
    },
    { 
      field: 'structureType', 
      headerName: 'Structure', 
      width: 120
    },
    { field: 'quantityOnHand', headerName: tProducts('columns.quantityOnHand'), width: 130, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value ? parseFloat(p.value as string).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0' },
    { field: 'productGroupName', headerName: tCommon('columns.group'), width: 160 },
    { field: 'defaultVendorName', headerName: tProducts('columns.vendor'), width: 160, hide: true },
    { field: 'standardCost', headerName: tProducts('columns.stdCost'), width: 100, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'listPrice', headerName: tProducts('columns.listPrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'tradePrice', headerName: tProducts('columns.tradePrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'priceLevel3', headerName: tProducts('columns.priceLevel3'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'priceLevel4', headerName: tProducts('columns.priceLevel4'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'barcode', headerName: tProducts('columns.barcode'), width: 130 },
    { field: 'purchaseTaxCategoryId', headerName: tProducts('columns.purchaseTaxCategory'), width: 120, hide: true },
    { field: 'salesTaxCategoryId', headerName: tProducts('columns.salesTaxCategory'), width: 120, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
      }
    },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120, hide: true },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: ValueFormatterParams) => p.value ? new Date(p.value as string).toLocaleDateString() : '—',
    },
  ], [tCommon, tProducts]);

  return (
    <DataGrid
      endpoint="/api/products"
      columns={columns}
      gridKey="ops-products"
      searchPlaceholder={tProducts('placeholders.searchProducts')}
      exportFileName="products"
      showArchivedToggle
      rowIdField="productId"
      onRowClicked={(row: Record<string, unknown>) => router.push(`/products/${row.productId as string}`)}
      pageTitle={tProducts('title')}
      headerActions={
        <Button asChild variant="primary">
          <Link href="/products/new">
            {tProducts('buttons.addProduct')}
          </Link>
        </Button>
      }
    />
  );
}
