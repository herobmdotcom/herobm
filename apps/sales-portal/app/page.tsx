'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';

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

const columns: ColDef<UnifiedOrder>[] = [
  {
    field: 'orderNumber',
    headerName: 'Order #',
    width: 140,
    pinned: 'left',
  },
  { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 160 },
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
  { field: 'customerOrderNumber', headerName: 'Customer PO', width: 140 },
  {
    field: 'totalPrice',
    headerName: 'Total',
    width: 120,
    cellDataType: 'number',
    valueGetter: (params: { data?: UnifiedOrder }) => {
      if (!params.data?.totalPrice) return null;
      return parseFloat(params.data.totalPrice);
    },
    valueFormatter: (params: { value?: number; data?: UnifiedOrder }) => {
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

export default function OrdersPage() {
  const router = useRouter();

  const handleRowClicked = useCallback((order: UnifiedOrder) => {
    if (order.source === 'app') {
      router.push(`/sales-orders/${order.id}?source=app`);
    } else {
      router.push(`/sales-orders/${encodeURIComponent(order.orderNumber)}?source=abm`);
    }
  }, [router]);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage sales orders
          </p>
        </div>
        <button
          id="btn-new-order"
          className="btn btn-primary"
          onClick={() => router.push('/sales-orders/new')}
        >
          ➕ New Order
        </button>
      </div>
      <DataGrid<UnifiedOrder>
        endpoint="/api/sales-orders"
        columns={columns}
        gridKey="sales-orders"
        searchPlaceholder="Search orders…"
        exportFileName="orders"
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
