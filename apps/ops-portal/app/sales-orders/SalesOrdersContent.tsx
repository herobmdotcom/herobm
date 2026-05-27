'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

import { useSettings } from '@/components/SettingsProvider';

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  name: string;
  customerName: string;
  customerOrderNumber: string;
  stateCode: string;
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

export default function SalesOrdersContent() {
  const { baseCurrency } = useSettings();
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');
  const tStates = useTranslations('common.states');
  const [days, setDays] = useState('90');

  const columns = useMemo<ColDef<UnifiedOrder>[]>(() => [
    { field: 'orderNumber', headerName: tCommon('columns.orderNumber'), width: 150, pinned: 'left' },
    { field: 'customerName', headerName: tCommon('columns.customer'), flex: 1, minWidth: 180 },
    { field: 'name', headerName: tCommon('columns.name'), width: 160 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 110,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as any) ? tStates(s as any) : String(params.value);
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
        return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
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
    router.push(`/sales-orders/${order.id}`);
  }, [router]);

  return (
    <DataGrid<UnifiedOrder>
      endpoint={`/api/sales-orders?days=${days}`}
      columns={columns}
      gridKey="ops-orders"
      searchPlaceholder={tSales('placeholders.searchOrders')}
      exportFileName="orders"
      fetchAll
      showArchivedToggle
      rowIdField="id"
      onRowClicked={handleRowClicked}
      pageTitle={tSales('title')}
      headerFilters={
        <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 120 }}
        >
            <option value="30">{tCommon('filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
            <option value="90">{tCommon('filters.last90Days', { defaultValue: 'Last 90 Days' })}</option>
            <option value="365">{tCommon('filters.last1Year', { defaultValue: 'Last 1 Year' })}</option>
            <option value="0">{tCommon('filters.allTime', { defaultValue: 'All Time' })}</option>
        </select>
      }
      headerActions={
        <Link href="/sales-orders/new" className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
          {tSales('buttons.createOrder')}
        </Link>
      }
    />
  );
}
