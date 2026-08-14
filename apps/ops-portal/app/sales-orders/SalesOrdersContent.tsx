'use client';

import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

import { formatLocalDate } from '@/lib/date';
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
  customFields: Record<string, unknown> | null;
}

export default function SalesOrdersContent() {
  const { baseCurrency } = useSettings();
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');
  const tStates = useTranslations('common.states');
  const [days, setDays, isReady] = usePersistedFilter('sales-orders-days', '90');

  const columns = useMemo<ColDef<UnifiedOrder>[]>(() => [
    { field: 'orderNumber', headerName: tCommon('columns.orderNumber'), width: 150, pinned: 'left' },
    { field: 'customerName', headerName: tCommon('columns.customer'), flex: 1, minWidth: 180 },
    { field: 'name', headerName: tCommon('columns.name'), width: 160 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 110,
      valueFormatter: (params: { value?: unknown }) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic translation key from API state code
        return tStates.has(s as any) ? tStates(s as any) : String(params.value);
      },
    },
    { field: 'customerOrderNumber', headerName: tCommon('columns.customerPO'), width: 140 },
    {
      colId: 'analysisCode',
      headerName: 'Analysis Code',
      width: 140,
      valueGetter: (params: { data?: UnifiedOrder }) => {
        if (!params.data?.customFields) return '';
        return (params.data.customFields as Record<string, string>)?.analysisCode || '';
      },
    },
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
        return formatLocalDate(params.value as string);
      },
    },
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120 },
  ], [tCommon, baseCurrency, tStates]);



  return (
    <DataGrid<UnifiedOrder>
      endpoint={isReady ? `/api/sales-orders?days=${days}` : undefined}
      columns={columns}
      gridKey="ops-orders"
      searchPlaceholder={tSales('placeholders.searchOrders')}
      exportFileName="orders"
      showArchivedToggle
      rowIdField="id"
      rowHref={(order) => `/sales-orders/${order.id}`}
      pageTitle={tSales('title')}
      defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
      headerFilters={
        <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm min-w-[120px]"
        >
            <option value="30">{tCommon('filters.last30Days')}</option>
            <option value="90">{tCommon('filters.last90Days')}</option>
            <option value="365">{tCommon('filters.last1Year')}</option>
            <option value="0">{tCommon('filters.allTime')}</option>
        </select>
      }
      headerActions={
        <Button asChild variant="primary">
          <Link href="/sales-orders/new">
            {tSales('buttons.createOrder')}
          </Link>
        </Button>
      }
    />
  );
}
