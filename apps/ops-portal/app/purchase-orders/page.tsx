'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  invoiceNumber: string;
  stateCode: string;
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');

  const columns = useMemo<ColDef<UnifiedPurchaseOrderRow>[]>(() => [
    {
      field: 'orderNumber',
      headerName: tCommon('columns.orderNumber'),
      width: 140,
      pinned: 'left',
    },
    { field: 'vendorName', headerName: tCommon('columns.vendor'), flex: 1, minWidth: 160 },
    { field: 'name', headerName: tCommon('columns.name'), width: 160 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      },
    },
    { field: 'invoiceNumber', headerName: tCommon('columns.invoiceNumber'), width: 140 },
    {
      field: 'totalPrice',
      headerName: tCommon('columns.totalPrice'),
      width: 120,
      cellDataType: 'number',
      valueGetter: (params: { data?: UnifiedPurchaseOrderRow }) => {
        if (!params.data?.totalPrice) return null;
        return parseFloat(params.data.totalPrice);
      },
      valueFormatter: (params: { value?: number; data?: UnifiedPurchaseOrderRow }) => {
        if (!params.value || params.value === 0) return '—';
        return formatAmount(params.value, params.data?.currencyCode || 'EUR');
      },
    },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90, hide: true },
    {
      field: 'createdOn',
      headerName: tCommon('columns.date'),
      width: 110,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
  ], [tCommon]);

  const handleRowClicked = useCallback((order: UnifiedPurchaseOrderRow) => {
    router.push(`/purchase-orders/${order.id}`);
  }, [router]);

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedPurchaseOrderRow>
              endpoint="/api/purchase-orders"
              columns={columns}
              gridKey="purchase-orders"
              searchPlaceholder={tPurchase('placeholders.searchOrders')}
              exportFileName="purchase-orders"
              fetchAll
              showArchivedToggle
              onRowClicked={handleRowClicked}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tPurchase('title')}
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
                    <Link href="/purchase-orders/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                      {tPurchase('buttons.createPO')}
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
