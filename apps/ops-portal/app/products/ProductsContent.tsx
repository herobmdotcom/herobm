'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

export default function ProductsContent() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'productNumber', headerName: tProducts('columns.productNumber'), width: 130, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'alternateProductNumber', headerName: tProducts('columns.alternateProductNumber'), width: 140 },
    { field: 'quantityOnHand', headerName: tProducts('columns.quantityOnHand'), width: 130, type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0' },
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
    { field: 'purchaseTaxCategoryId', headerName: tProducts('columns.purchaseTaxCategory'), width: 120, hide: true },
    { field: 'salesTaxCategoryId', headerName: tProducts('columns.salesTaxCategory'), width: 120, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      }
    },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120, hide: true },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
  ], [tCommon, tProducts]);

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid
              endpoint="/api/products"
              columns={columns}
              gridKey="ops-products"
              searchPlaceholder={tProducts('placeholders.searchProducts')}
              exportFileName="products"
              fetchAll
              showArchivedToggle
              rowIdField="productId"
              onRowClicked={(row: any) => router.push(`/products/${row.productId}`)}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tProducts('title')}
                    </h2>
                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                      <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tCommon('grid.rowCountLabel')}
                      </span>
                      <span className="text-[11px] font-bold text-[#006b5c]">
                        {loading ? '...' : rowCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex-1 ml-4 max-w-md">
                      {searchInput}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {optionsButton}
                    <Link href="/products/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                      + {tProducts('buttons.addProduct')}
                    </Link>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
