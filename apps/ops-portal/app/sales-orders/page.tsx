'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  name: string;
  customerName: string;
  customerOrderNumber: string;
  stateCode: string;
  source: 'abm' | 'app';
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

export default function OrdersPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  const columns = useMemo<ColDef<UnifiedOrder>[]>(() => [
    { field: 'orderNumber', headerName: tCommon('columns.orderNumber'), width: 150, pinned: 'left' },
    { field: 'customerName', headerName: tCommon('columns.customer'), flex: 1, minWidth: 180 },
    { field: 'name', headerName: tCommon('columns.name'), width: 160 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 110,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      },
    },
    {
      field: 'source',
      headerName: tCommon('columns.source'),
      width: 90,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        const label = params.value === 'abm' ? tCommon('sources.abm') : tCommon('sources.app');
        return <span className={`badge badge-${params.value}`}>{label}</span>;
      },
    },
    { field: 'customerOrderNumber', headerName: tCommon('columns.customerPO'), width: 140 },
    {
      field: 'totalPrice',
      headerName: tCommon('columns.totalPrice'),
      width: 120,
      type: 'numericColumn',
      valueGetter: (params: { data?: UnifiedOrder }) => {
        if (!params.data?.totalPrice) return null;
        return parseFloat(params.data.totalPrice);
      },
      valueFormatter: (params: { value?: number; data?: UnifiedOrder }) => {
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
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120 },
  ], [tCommon]);

  const handleRowClicked = useCallback((order: UnifiedOrder) => {
    if (order.source === 'app') {
      router.push(`/sales-orders/${order.id}?source=app`);
    } else {
      router.push(`/sales-orders/${encodeURIComponent(order.orderNumber)}?source=abm`);
    }
  }, [router]);

  return (
    <Shell>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedOrder>
              endpoint="/api/sales-orders"
              columns={columns}
              gridKey="ops-orders"
              searchPlaceholder={tSales('placeholders.searchOrders')}
              exportFileName="orders"
              fetchAll
              showArchivedToggle
              onRowClicked={handleRowClicked}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tSales('title')}
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
                    <Link href="/sales-orders/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                      {tSales('buttons.createOrder')}
                    </Link>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
