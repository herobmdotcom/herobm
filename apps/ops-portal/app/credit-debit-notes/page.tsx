'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/shared/Button';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';

import CreditNoteDetailSlideOver from './CreditNoteDetailSlideOver';
import DebitNoteDetailSlideOver from './DebitNoteDetailSlideOver';
import CreateNoteSlideOver from './CreateNoteSlideOver';

interface CreditNoteItem {
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

interface DebitNoteItem {
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

export interface UnifiedHistoryRow {
  id: string;
  noteId: string;
  type: 'credit_note' | 'debit_note';
  typeLabel?: string;
  noteNumber: string;
  referenceNumber: string;
  orderNumber: string;
  partyNumber: string;
  partyName: string;
  createdOn: string;
  notes: string;
  totalAmount: number;
  currencyCode?: string;
  stateCode: string;
}

export default function CreditDebitNotesPage() {
  const { baseCurrency } = useSettings();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  useDocumentTitle('Credit & Debit Notes');

  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [selectedDebitNoteId, setSelectedDebitNoteId] = useState<string | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRowClicked = useCallback((row: UnifiedHistoryRow) => {
    if (row.type === 'credit_note') {
      setSelectedCreditNoteId(row.noteId);
    } else {
      setSelectedDebitNoteId(row.noteId);
    }
  }, []);

  const gridColumns: ColDef<UnifiedHistoryRow>[] = useMemo(
    () => [
      { 
        field: 'type' as keyof UnifiedHistoryRow, 
        headerName: 'Type', 
        width: 140,
        valueGetter: (params: ValueGetterParams<UnifiedHistoryRow>) => {
          if (params.data?.type === 'credit_note') return 'Credit Note';
          if (params.data?.type === 'debit_note') return 'Debit Note';
          return params.data?.type;
        }
      },
      { field: 'noteNumber', headerName: 'Note Number', width: 160 },
      { field: 'referenceNumber', headerName: 'Reference', width: 140 },
      { field: 'orderNumber', headerName: 'Order No', width: 130 },
      { field: 'partyName', headerName: 'Customer / Supplier', minWidth: 200, flex: 1 },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<UnifiedHistoryRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'totalAmount',
        headerName: 'Total Amount',
        type: 'numericColumn',
        width: 150,
        valueGetter: (params: ValueGetterParams<UnifiedHistoryRow>) => {
          if (!params.data?.totalAmount) return null;
          return params.data.totalAmount;
        },
        valueFormatter: (params: ValueFormatterParams<UnifiedHistoryRow>) => {
          if (!params.value || params.value === 0) return '—';
          return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
        },
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.state'),
        width: 130,
        valueFormatter: (params: ValueFormatterParams<UnifiedHistoryRow>) => {
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
        endpoint="/api/global-notes"
        refreshTrigger={refreshTrigger}
        gridKey="credit-and-debit-notes-history"
        rowIdField="id"
        onRowClicked={handleRowClicked}
        pageTitle="Notes"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        headerActions={
          <Button
            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 whitespace-nowrap shadow-sm"
            onClick={() => setCreateNoteOpen(true)}
          >
            Create Note
          </Button>
        }
      />

      <CreateNoteSlideOver
        isOpen={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onSuccess={() => {
          setCreateNoteOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      <CreditNoteDetailSlideOver
        isOpen={!!selectedCreditNoteId}
        onClose={() => setSelectedCreditNoteId(null)}
        creditNoteId={selectedCreditNoteId}
      />

      <DebitNoteDetailSlideOver
        isOpen={!!selectedDebitNoteId}
        onClose={() => setSelectedDebitNoteId(null)}
        debitNoteId={selectedDebitNoteId}
      />
    </>
  );
}
