'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  invoiceNumber: string;
  stateCode: string;
  source: 'abm' | 'app';
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
    if (order.source === 'app') {
      router.push(`/purchase-orders/${order.id}?source=app`);
    } else {
      router.push(`/purchase-orders/${encodeURIComponent(order.orderNumber)}?source=abm`);
    }
  }, [router]);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tPurchase('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {tPurchase('subtitle')}
          </p>
        </div>
        <Link href="/purchase-orders/new" className="btn btn-secondary btn-sm">
          {tPurchase('buttons.createPO')}
        </Link>
      </div>
      <DataGrid<UnifiedPurchaseOrderRow>
        endpoint="/api/purchase-orders"
        columns={columns}
        gridKey="purchase-orders"
        searchPlaceholder={tPurchase('placeholders.searchOrders')}
        exportFileName="purchase-orders"
        fetchAll
        showArchivedToggle
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
