'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

import { useSettings } from '@/components/SettingsProvider';

interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  referenceNumber: string;
  stateCode: string;
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

export default function PurchaseOrdersContent() {
  const { baseCurrency } = useSettings();
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tStates = useTranslations('common.states');
  const [days, setDays] = useState('90');

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
      valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<any>) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
      },
    },
    { field: 'referenceNumber', headerName: tPurchase('columns.referenceNumber'), width: 140 },
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
  ], [tCommon]);

  const handleRowClicked = useCallback((order: UnifiedPurchaseOrderRow) => {
    router.push(`/purchase-orders/${order.id}`);
  }, [router]);

  return (
    <DataGrid<UnifiedPurchaseOrderRow>
      endpoint={`/api/purchase-orders?days=${days}`}
      columns={columns}
      gridKey="purchase-orders"
      searchPlaceholder={tPurchase('placeholders.searchOrders')}
      exportFileName="purchase-orders"
      fetchAll
      showArchivedToggle
      rowIdField="id"
      onRowClicked={handleRowClicked}
      pageTitle={tPurchase('title')}
      headerFilters={
        <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 150 }}
        >
            <option value="30">{tCommon('filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
            <option value="90">{tCommon('filters.last90Days', { defaultValue: 'Last 90 Days' })}</option>
            <option value="365">{tCommon('filters.last1Year', { defaultValue: 'Last 1 Year' })}</option>
            <option value="0">{tCommon('filters.allTime', { defaultValue: 'All Time' })}</option>
        </select>
      }
      headerActions={
        <Link href="/purchase-orders/new" className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
          {tPurchase('buttons.createPO')}
        </Link>
      }
    />
  );
}
