'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';

import CreditNoteDetailSlideOver from '../CreditNoteDetailSlideOver';
import DebitNoteDetailSlideOver from '../DebitNoteDetailSlideOver';

interface CreditNoteItem {
  creditNoteId: string;
  creditNoteNumber: string;
  orderNumber?: string;
  salesOrderNumber?: string;
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
  supplierReferenceNumber?: string;
  orderNumber?: string;
  vendorCode?: string;
  vendorId?: string;
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
  typeLabel: string;
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

export default function CreditAndDebitNotesHistoryPage() {
  const { baseCurrency } = useSettings();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  useDocumentTitle('Credit & Debit Notes Ledger');

  const [rows, setRows] = useState<UnifiedHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [selectedDebitNoteId, setSelectedDebitNoteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cnRes, dnRes] = await Promise.all([
        api.salesCreditNotesControllerFindAll().catch((err: unknown) => {
          reportError(err, 'HistoryPage.fetchCreditNotes');
          return { data: [] };
        }),
        api.purchaseDebitNotesControllerFindAll().catch((err: unknown) => {
          reportError(err, 'HistoryPage.fetchDebitNotes');
          return { data: [] };
        }),
      ]);

      const cnRaw = cnRes?.data as unknown;
      const dnRaw = dnRes?.data as unknown;
      const cnList = (Array.isArray(cnRaw) ? cnRaw : (cnRaw as { data?: CreditNoteItem[] })?.data || []) as CreditNoteItem[];
      const dnList = (Array.isArray(dnRaw) ? dnRaw : (dnRaw as { data?: DebitNoteItem[] })?.data || []) as DebitNoteItem[];

      const cnRows: UnifiedHistoryRow[] = cnList.map((cn) => {
        const subtotal = parseFloat(cn.totalAmount?.toString() || '0');
        const tax = parseFloat(cn.taxAmount?.toString() || '0');
        const fee = parseFloat(cn.feeAmount?.toString() || '0');
        const grossTotal = subtotal + tax - fee;
        return {
          id: `cn-${cn.creditNoteId}`,
          noteId: cn.creditNoteId,
          type: 'credit_note',
          typeLabel: 'Credit Note',
          noteNumber: cn.creditNoteNumber,
          referenceNumber: cn.orderNumber || cn.salesOrderNumber || '—',
          orderNumber: cn.orderNumber || cn.salesOrderNumber || '—',
          partyNumber: cn.customerNumber || '—',
          partyName: cn.customerName || '—',
          createdOn: cn.createdOn,
          notes: cn.notes || '',
          totalAmount: grossTotal > 0 ? grossTotal : subtotal,
          currencyCode: cn.currencyCode,
          stateCode: cn.stateCode,
        };
      });

      const dnRows: UnifiedHistoryRow[] = dnList.map((dn) => {
        const subtotal = parseFloat(dn.totalAmount?.toString() || '0');
        const tax = parseFloat(dn.taxAmount?.toString() || '0');
        const fee = parseFloat(dn.feeAmount?.toString() || '0');
        const grossTotal = subtotal + tax - fee;
        return {
          id: `dn-${dn.debitNoteId}`,
          noteId: dn.debitNoteId,
          type: 'debit_note',
          typeLabel: 'Debit Note',
          noteNumber: dn.debitNoteNumber,
          referenceNumber: dn.supplierReferenceNumber || dn.orderNumber || '—',
          orderNumber: dn.orderNumber || '—',
          partyNumber: dn.vendorCode || dn.vendorId?.substring(0, 8) || '—',
          partyName: dn.vendorName || '—',
          createdOn: dn.createdOn,
          notes: dn.notes || '',
          totalAmount: grossTotal > 0 ? grossTotal : subtotal,
          currencyCode: dn.currencyCode,
          stateCode: dn.stateCode,
        };
      });

      setRows([...cnRows, ...dnRows]);
    } catch (err) {
      reportError(err, 'CreditAndDebitNotesHistoryPage.loadData');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRowClicked = useCallback((row: UnifiedHistoryRow) => {
    if (row.type === 'credit_note') {
      setSelectedCreditNoteId(row.noteId);
    } else {
      setSelectedDebitNoteId(row.noteId);
    }
  }, []);

  const gridColumns: ColDef<UnifiedHistoryRow>[] = useMemo(
    () => [
      { field: 'typeLabel', headerName: 'Type', width: 140 },
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
        rowData={rows}
        columns={gridColumns}
        gridKey="credit-and-debit-notes-history"
        rowIdField="id"
        onRowClicked={handleRowClicked}
        pageTitle="Credit & Debit Notes History"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
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
