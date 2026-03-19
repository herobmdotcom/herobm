'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

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
        return <span className={`badge badge-${params.value}`}>{tCommon(`states.${params.value}`)}</span>;
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{tSales('title')}</h2>
        <Link href="/sales-orders/new" className="btn btn-secondary btn-sm">
          {tSales('buttons.createOrder')}
        </Link>
      </div>
      <DataGrid<UnifiedOrder>
        endpoint="/api/sales-orders"
        columns={columns}
        gridKey="ops-orders"
        searchPlaceholder={tSales('placeholders.searchOrders')}
        exportFileName="orders"
        fetchAll
        showArchivedToggle
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
