'use client';

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import StateBadge from '@/components/StateBadge';
import { routes } from '@/lib/routes';
import type { ColDef, ValueFormatterParams, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import type { ValidState } from '@/types/states';

export interface SalesReturnRow {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerNumber?: string;
  customerName?: string;
  createdOn: string;
  stateCode: string;
  lines?: unknown[];
  notes?: string;
}

export default function SalesReturnsPage() {
  const tCommon = useTranslations('common');
  const router = useRouter();
  useDocumentTitle('Sales Returns');

  const handleRowClicked = useCallback(
    (row: SalesReturnRow) => {
      if (row.returnId) {
        router.push(routes.salesReturns.detail(row.returnId));
      }
    },
    [router],
  );

  const gridColumns: ColDef<SalesReturnRow>[] = useMemo(
    () => [
      { field: 'returnNumber', headerName: 'Return No', width: 140 },
      {
        field: 'orderNumber',
        headerName: 'Order No',
        width: 140,
        valueGetter: (p: ValueGetterParams<SalesReturnRow>) =>
          p.data?.orderNumber || p.data?.salesOrderNumber || '—',
      },
      {
        field: 'customerName',
        headerName: 'Customer',
        minWidth: 200,
        flex: 1,
        valueGetter: (p: ValueGetterParams<SalesReturnRow>) => {
          const name = p.data?.customerName;
          const num = p.data?.customerNumber;
          if (name && num) return `${num} - ${name}`;
          return name || num || '—';
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<SalesReturnRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.status'),
        width: 140,
        cellRenderer: (p: ICellRendererParams<SalesReturnRow>) => {
          if (!p.value) return null;
          return <StateBadge state={p.value as ValidState} />;
        },
      },
      {
        field: 'lines',
        headerName: 'Lines',
        width: 100,
        cellRenderer: (p: ICellRendererParams<SalesReturnRow>) => {
          if (!p.value || !Array.isArray(p.value)) return '0 items';
          return tCommon('itemsCount', { count: p.value.length });
        },
      },
      { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 180 },
    ],
    [tCommon],
  );

  return (
    <DataGrid
      columns={gridColumns}
      endpoint="/api/sales-returns"
      gridKey="sales-returns-list"
      rowIdField="returnId"
      onRowClicked={handleRowClicked}
      pageTitle="Sales Returns"
      defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
    />
  );
}
