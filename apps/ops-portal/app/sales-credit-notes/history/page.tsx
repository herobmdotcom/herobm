'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';

import CreditNoteDetailSlideOver from '../CreditNoteDetailSlideOver';

interface CreditNoteHistoryRow {
  creditNoteId: string;
  creditNoteNumber: string;
  customerNumber?: string;
  customerName?: string;
  createdOn: string;
  notes: string;
  totalAmount: number;
  currencyCode?: string;
  stateCode: string;
}

export default function CreditNotesHistoryPage() {
    const { baseCurrency } = useSettings();
    const tCommon = useTranslations('common');
    const tStates = useTranslations('common.states');
    useDocumentTitle('Credit Notes Ledger');
    const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);

    const handleRowClicked = useCallback((row: CreditNoteHistoryRow) => {
        setSelectedCreditNoteId(row.creditNoteId);
    }, []);

    const gridEndpoint = `/api/sales-credit-notes`;
    
    const gridColumns: ColDef<CreditNoteHistoryRow>[] = [
        { field: 'creditNoteId', headerName: 'ID', hide: true },
        { field: 'creditNoteNumber', headerName: 'CN Number', width: 160 },
        { field: 'customerNumber', headerName: 'Customer No', width: 140 },
        { field: 'customerName', headerName: 'Customer Name', minWidth: 200, flex: 1 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 160, valueFormatter: (p: ValueFormatterParams<CreditNoteHistoryRow>) => formatLocalDate(p.value as string | number, undefined, '') },
        { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 200 },
        { field: 'totalAmount', headerName: 'Total Credit', type: 'numericColumn', width: 150,
            valueGetter: (params: ValueGetterParams<CreditNoteHistoryRow>) => {
                if (!params.data?.totalAmount) return null;
                return parseFloat(params.data.totalAmount.toString());
            },
            valueFormatter: (params: ValueFormatterParams<CreditNoteHistoryRow>) => {
                if (!params.value || params.value === 0) return '—';
                return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
            },
        },
        { 
            field: 'stateCode', 
            headerName: tCommon('columns.state'), 
            width: 140,
            valueFormatter: (params: ValueFormatterParams<CreditNoteHistoryRow>) => {
                if (!params.value) return '';
                const s = String(params.value).toLowerCase();
                const key = s as unknown as Parameters<typeof tStates>[0];
                return tStates.has(key) ? tStates(key) : String(params.value);
            }
        },
    ];

    return (
        <>
            <DataGrid 
                endpoint={gridEndpoint} 
                columns={gridColumns} 
                gridKey="credit-notes-history"
                rowIdField="creditNoteId"
                onRowClicked={handleRowClicked}
                pageTitle="Credit Notes History"
                defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
            />
            <CreditNoteDetailSlideOver
                isOpen={!!selectedCreditNoteId}
                onClose={() => setSelectedCreditNoteId(null)}
                creditNoteId={selectedCreditNoteId}
            />
        </>
    );
}
