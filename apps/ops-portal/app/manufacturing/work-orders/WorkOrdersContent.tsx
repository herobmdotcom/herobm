'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import { WORK_ORDER_STATE } from '@herobm/shared';

interface WorkOrderRow {
  workOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productNumber: string;
  targetQuantity: string;
  completedQuantity: string;
  locationId: string;
  locationName: string;
  wipBinId?: string | null;
  wipBinName?: string | null;
  stateCode: string;
  totalCost?: string | null;
  createdBy?: string | null;
  createdOn?: string | null;
}

export default function WorkOrdersContent() {
  const tCommon = useTranslations('common');
  const tWork = useTranslations('workOrders');
  const [days, setDays, isReady] = usePersistedFilter('work-orders-days', '90');

  const columns = useMemo<ColDef<WorkOrderRow>[]>(
    () => [
      {
        field: 'orderNumber',
        headerName: tWork('columns.orderNumber'),
        width: 160,
        pinned: 'left',
      },
      {
        field: 'productName',
        headerName: tWork('columns.product'),
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => {
          if (!params.data) return '';
          return `${params.data.productName} (${params.data.productNumber})`;
        },
      },
      {
        field: 'locationName',
        headerName: tWork('columns.location'),
        width: 150,
      },
      {
        field: 'targetQuantity',
        headerName: tWork('columns.targetQty'),
        width: 120,
        cellDataType: 'number',
        valueGetter: (params) => parseFloat(params.data?.targetQuantity || '0'),
      },
      {
        field: 'completedQuantity',
        headerName: tWork('columns.completedQty'),
        width: 130,
        cellDataType: 'number',
        valueGetter: (params) => parseFloat(params.data?.completedQuantity || '0'),
      },
      {
        field: 'stateCode',
        headerName: tWork('columns.status'),
        width: 140,
        cellRenderer: (params: { value: string }) => {
          if (!params.value) return null;
          const formatted = params.value.replace(/_/g, ' ').toUpperCase();
          let badgeClass = 'bg-gray-100 text-gray-800';

          if (params.value === WORK_ORDER_STATE.DRAFT) badgeClass = 'bg-yellow-100 text-yellow-800';
          else if (params.value === WORK_ORDER_STATE.IN_PROGRESS) badgeClass = 'bg-blue-100 text-blue-800';
          else if (params.value === WORK_ORDER_STATE.COMPLETED) badgeClass = 'bg-green-100 text-green-800';
          else if (params.value === WORK_ORDER_STATE.CANCELLED) badgeClass = 'bg-red-100 text-red-800';

          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
              {formatted}
            </span>
          );
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (params) => {
          if (!params.value) return '—';
          return new Date(params.value as string).toLocaleDateString();
        },
      },
    ],
    [tWork, tCommon]
  );

  return (
    <DataGrid<WorkOrderRow>
      endpoint={isReady ? `/api/manufacturing/work-orders?days=${days}` : undefined}
      columns={columns}
      gridKey="work-orders"
      searchPlaceholder={tWork('placeholders.searchOrders')}
      exportFileName="work-orders"
      rowIdField="workOrderId"
      rowHref={(row) => `/manufacturing/work-orders/${row.workOrderId}`}
      pageTitle={tWork('title')}
      defaultSortModel={[{ colId: 'orderNumber', sort: 'desc' }]}
      headerFilters={
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="input text-sm"
        >
          <option value="30">{tCommon('filters.last30Days')}</option>
          <option value="90">{tCommon('filters.last90Days')}</option>
          <option value="365">{tCommon('filters.last1Year')}</option>
          <option value="all">{tCommon('filters.allTime')}</option>
        </select>
      }
      headerActions={
        <Button asChild variant="primary">
          <Link href="/manufacturing/work-orders/new">
            {tWork('buttons.createWorkOrder')}
          </Link>
        </Button>
      }
    />
  );
}

