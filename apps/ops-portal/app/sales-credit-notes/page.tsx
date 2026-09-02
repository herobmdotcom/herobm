'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/shared/Button';
import CreateNoteSlideOver from '@/app/credit-debit-notes/CreateNoteSlideOver';
import { routes } from '@/lib/routes';
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';

export interface SalesCreditNoteRow {
  creditNoteId: string;
  creditNoteNumber: string;
  orderNumber?: string;
  salesOrderNumber?: string;
  referenceNumber?: string;
  returnNumber?: string;
  customerNumber?: string;
  customerName?: string;
  createdOn: string;
  notes?: string;
  totalAmount?: string | number;
  taxAmount?: string | number;
  feeAmount?: string | number;
  currencyCode?: string;
  stateCode: string;
}

export default function SalesCreditNotesPage() {
  const { baseCurrency } = useSettings();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const router = useRouter();
  useDocumentTitle('Sales Credit Notes');

  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const gridColumns: ColDef<SalesCreditNoteRow>[] = useMemo(
    () => [
      { field: 'creditNoteNumber', headerName: 'Note Number', width: 160 },
      {
        field: 'orderNumber',
        headerName: 'Order No',
        width: 140,
        valueGetter: (params: ValueGetterParams<SalesCreditNoteRow>) =>
          params.data?.orderNumber || params.data?.salesOrderNumber || '—',
      },
      {
        field: 'returnNumber',
        headerName: 'Return No',
        width: 140,
        valueGetter: (params: ValueGetterParams<SalesCreditNoteRow>) =>
          params.data?.returnNumber || params.data?.referenceNumber || '—',
      },
      {
        field: 'customerName',
        headerName: 'Customer',
        minWidth: 200,
        flex: 1,
        valueGetter: (params: ValueGetterParams<SalesCreditNoteRow>) => {
          const name = params.data?.customerName;
          const num = params.data?.customerNumber;
          if (name && num) return `${num} - ${name}`;
          return name || num || '—';
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<SalesCreditNoteRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'totalAmount',
        headerName: 'Total Amount',
        type: 'numericColumn',
        width: 150,
        valueGetter: (params: ValueGetterParams<SalesCreditNoteRow>) => {
          if (!params.data?.totalAmount) return null;
          return params.data.totalAmount;
        },
        valueFormatter: (params: ValueFormatterParams<SalesCreditNoteRow>) => {
          if (!params.value || params.value === 0) return '—';
          return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
        },
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.state'),
        width: 130,
        valueFormatter: (params: ValueFormatterParams<SalesCreditNoteRow>) => {
          if (!params.value) return '';
          const s = String(params.value).toLowerCase();
          const key = s as unknown as Parameters<typeof tStates>[0];
          return tStates.has(key) ? tStates(key) : String(params.value);
        },
      },
      { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 180 },
    ],
    [baseCurrency, tCommon, tStates],
  );

  return (
    <>
      <DataGrid
        columns={gridColumns}
        endpoint="/api/sales-credit-notes"
        refreshTrigger={refreshTrigger}
        gridKey="sales-credit-notes-list"
        rowIdField="creditNoteId"
        rowHref={(row) => (row.creditNoteId ? routes.salesCreditNotes.detail(row.creditNoteId) : '')}
        pageTitle="Sales Credit Notes"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        headerActions={
          <Button
            variant="primary"
            onClick={() => setCreateNoteOpen(true)}
          >
            Create Credit Note
          </Button>
        }
      />

      <CreateNoteSlideOver
        isOpen={createNoteOpen}
        initialType="credit"
        onClose={() => setCreateNoteOpen(false)}
        onSuccess={() => {
          setCreateNoteOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </>
  );
}
