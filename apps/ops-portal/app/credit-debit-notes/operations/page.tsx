'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import ReturnCreditNoteSlideOver from '../ReturnCreditNoteSlideOver';
import ReturnDebitNoteSlideOver from '../ReturnDebitNoteSlideOver';
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';

export interface UnifiedReturnRow {
  type: 'customer_return' | 'supplier_return';
  typeLabel?: string;
  returnId: string;
  returnNumber: string;
  orderNumber: string;
  partyNumber: string;
  partyName: string;
  createdOn: string;
  stateCode: string;
  putawayStatus?: string;
  linesCount: number;
  notes: string;
  rawRecord?: unknown;
}

interface RawCustomerReturn {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerNumber?: string;
  customerId?: string;
  customerName?: string;
  createdOn: string;
  stateCode: string;
  lines?: { putawayStatus?: string }[];
  notes?: string;
}

interface RawSupplierReturn {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  purchaseOrderNumber?: string;
  vendorCode?: string;
  vendorId?: string;
  vendorName?: string;
  createdOn: string;
  stateCode: string;
  lines?: unknown[];
  notes?: string;
}

export default function CreditDebitOperationsPage() {
  const tCommon = useTranslations('common');
  useDocumentTitle('Operations');

  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedCustomerReturn, setSelectedCustomerReturn] = useState<unknown | null>(null);
  const [selectedSupplierReturn, setSelectedSupplierReturn] = useState<unknown | null>(null);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleReturnClick = useCallback((row: UnifiedReturnRow) => {
    if (row.type === 'customer_return') {
      setSelectedCustomerReturn(row.rawRecord || row);
    } else {
      setSelectedSupplierReturn(row.rawRecord || row);
    }
  }, []);

  const gridColumns: ColDef<UnifiedReturnRow>[] = useMemo(
    () => [
      {
        field: 'typeLabel',
        headerName: 'Type',
        width: 140,
        valueGetter: (p: ValueGetterParams<UnifiedReturnRow>) =>
          p.data?.type === 'customer_return' ? 'Customer Return' : 'Supplier Return',
      },
      { field: 'returnNumber', headerName: 'Return No', width: 140 },
      { field: 'orderNumber', headerName: 'Order No', width: 140 },
      { field: 'partyNumber', headerName: 'Party No', width: 130 },
      { field: 'partyName', headerName: 'Customer / Supplier', minWidth: 200, flex: 1 },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.status'),
        width: 120,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) => {
          const val = p.value as string;
          if (!val) return '';
          return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        },
      },
      {
        field: 'putawayStatus',
        headerName: 'Putaway / Shipping',
        width: 150,
      },
      {
        field: 'linesCount',
        headerName: 'Lines',
        width: 100,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) => {
          if (p.value === undefined || p.value === null) return '';
          return tCommon('itemsCount', { count: p.value });
        },
      },
      { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 },
    ],
    [tCommon],
  );

  return (
    <>
      <DataGrid
        endpoint="/api/global-returns"
        columns={gridColumns}
        gridKey="unified-returns-queue-list"
        rowIdField="returnId"
        onRowClicked={handleReturnClick}
        pageTitle="Operations"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        refreshTrigger={refreshKey}
      />

      <ReturnCreditNoteSlideOver
        isOpen={!!selectedCustomerReturn}
        onClose={() => setSelectedCustomerReturn(null)}
        returnRecord={selectedCustomerReturn}
        onSuccess={() => {
          setSelectedCustomerReturn(null);
          triggerRefresh();
        }}
      />

      <ReturnDebitNoteSlideOver
        isOpen={!!selectedSupplierReturn}
        onClose={() => setSelectedSupplierReturn(null)}
        returnRecord={selectedSupplierReturn}
        onSuccess={() => {
          setSelectedSupplierReturn(null);
          triggerRefresh();
        }}
      />
    </>
  );
}
