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

export interface PurchaseDebitNoteRow {
  debitNoteId: string;
  debitNoteNumber: string;
  orderNumber?: string;
  supplierReferenceNumber?: string;
  referenceNumber?: string;
  vendorId?: string;
  vendorCode?: string;
  vendorName?: string;
  createdOn: string;
  notes?: string;
  totalAmount?: string | number;
  taxAmount?: string | number;
  feeAmount?: string | number;
  currencyCode?: string;
  stateCode: string;
}

export default function PurchaseDebitNotesPage() {
  const { baseCurrency } = useSettings();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const router = useRouter();
  useDocumentTitle('Purchase Debit Notes');

  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const gridColumns: ColDef<PurchaseDebitNoteRow>[] = useMemo(
    () => [
      { field: 'debitNoteNumber', headerName: 'Note Number', width: 160 },
      { field: 'supplierReferenceNumber', headerName: 'Supplier Ref', width: 140 },
      { field: 'orderNumber', headerName: 'Order No', width: 140 },
      {
        field: 'vendorName',
        headerName: 'Supplier',
        minWidth: 200,
        flex: 1,
        valueGetter: (params: ValueGetterParams<PurchaseDebitNoteRow>) => {
          const name = params.data?.vendorName;
          const code = params.data?.vendorCode;
          if (name && code) return `${code} - ${name}`;
          return name || code || '—';
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<PurchaseDebitNoteRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'totalAmount',
        headerName: 'Total Amount',
        type: 'numericColumn',
        width: 150,
        valueGetter: (params: ValueGetterParams<PurchaseDebitNoteRow>) => {
          if (!params.data?.totalAmount) return null;
          return params.data.totalAmount;
        },
        valueFormatter: (params: ValueFormatterParams<PurchaseDebitNoteRow>) => {
          if (!params.value || params.value === 0) return '—';
          return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
        },
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.state'),
        width: 130,
        valueFormatter: (params: ValueFormatterParams<PurchaseDebitNoteRow>) => {
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
        endpoint="/api/purchase-debit-notes"
        refreshTrigger={refreshTrigger}
        gridKey="purchase-debit-notes-list"
        rowIdField="debitNoteId"
        rowHref={(row) => (row.debitNoteId ? routes.purchaseDebitNotes.detail(row.debitNoteId) : '')}
        pageTitle="Purchase Debit Notes"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        headerActions={
          <Button
            variant="primary"
            onClick={() => setCreateNoteOpen(true)}
          >
            Create Debit Note
          </Button>
        }
      />

      <CreateNoteSlideOver
        isOpen={createNoteOpen}
        initialType="debit"
        onClose={() => setCreateNoteOpen(false)}
        onSuccess={() => {
          setCreateNoteOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </>
  );
}
