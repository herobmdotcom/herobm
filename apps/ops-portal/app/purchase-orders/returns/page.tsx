'use client';

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import StateBadge from '@/components/StateBadge';
import { Button } from '@/components/shared/Button';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import type { ColDef, ValueFormatterParams, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import type { ValidState } from '@/types/states';

export interface PurchaseReturnRow {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  vendorId?: string;
  vendorCode?: string;
  vendorName?: string;
  createdOn: string;
  stateCode: string;
  notes?: string;
  debitNoteId?: string;
  debitNoteNumber?: string;
  debitNoteState?: string;
  debitNoteTotalAmount?: string;
}

export default function PurchaseReturnsPage() {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const router = useRouter();
  useDocumentTitle('Purchase Returns');

  const gridColumns: ColDef<PurchaseReturnRow>[] = useMemo(
    () => [
      { field: 'returnNumber', headerName: 'Return No', width: 140 },
      {
        field: 'orderNumber',
        headerName: tCommon('columns.orderNumber'),
        width: 140,
        valueGetter: (p: ValueGetterParams<PurchaseReturnRow>) => p.data?.orderNumber || '—',
      },
      {
        field: 'vendorName',
        headerName: tCommon('columns.vendor'),
        minWidth: 200,
        flex: 1,
        valueGetter: (p: ValueGetterParams<PurchaseReturnRow>) => {
          const name = p.data?.vendorName;
          const code = p.data?.vendorCode;
          if (name && code) return `${code} - ${name}`;
          return name || code || '—';
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<PurchaseReturnRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.status'),
        width: 140,
        cellRenderer: (p: ICellRendererParams<PurchaseReturnRow>) => {
          if (!p.value) return null;
          return <StateBadge state={p.value as ValidState} />;
        },
      },
      {
        field: 'debitNoteNumber',
        headerName: 'Debit Note',
        width: 140,
        valueGetter: (p: ValueGetterParams<PurchaseReturnRow>) => p.data?.debitNoteNumber || '—',
      },
      { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 180 },
    ],
    [tCommon],
  );

  return (
    <DataGrid
      columns={gridColumns}
      endpoint="/api/purchase-returns"
      gridKey="purchase-returns-list"
      fetchAll
      rowIdField="returnId"
      rowHref={(row) => (row.returnId ? routes.purchaseOrders.returns.detail(row.returnId) : '')}
      pageTitle="Purchase Returns"
      defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
      headerActions={
        <Button asChild variant="primary">
          <Link href={routes.purchaseOrders.returns.new()}>
            {tPurchase('returns.createReturn')}
          </Link>
        </Button>
      }
    />
  );
}
