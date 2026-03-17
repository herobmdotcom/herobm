'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';

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

const columns: ColDef<UnifiedPurchaseOrderRow>[] = [
  {
    field: 'orderNumber',
    headerName: 'Order #',
    width: 140,
    pinned: 'left',
  },
  { field: 'vendorName', headerName: 'Vendor', flex: 1, minWidth: 160 },
  { field: 'name', headerName: 'Name', width: 160 },
  {
    field: 'stateCode',
    headerName: 'Status',
    width: 110,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      return <span className={`badge badge-${params.value}`}>{params.value}</span>;
    },
  },
  {
    field: 'source',
    headerName: 'Source',
    width: 90,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      const label = params.value === 'abm' ? 'ABM' : 'App';
      return <span className={`badge badge-${params.value}`}>{label}</span>;
    },
  },
  { field: 'invoiceNumber', headerName: 'Invoice #', width: 140 },
  {
    field: 'totalPrice',
    headerName: 'Total',
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
  {
    field: 'createdOn',
    headerName: 'Date',
    width: 110,
    valueFormatter: (params: { value: unknown }) => {
      if (!params.value) return '—';
      return new Date(params.value as string).toLocaleDateString();
    },
  },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();

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
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage purchase orders
          </p>
        </div>
        <button
          id="btn-new-order"
          className="btn btn-primary"
          onClick={() => router.push('/purchase-orders/new')}
        >
          ➕ Create PO
        </button>
      </div>
      <DataGrid<UnifiedPurchaseOrderRow>
        endpoint="/api/purchase-orders"
        columns={columns}
        gridKey="purchase-orders"
        searchPlaceholder="Search purchase orders…"
        exportFileName="purchase-orders"
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
