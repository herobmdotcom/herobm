'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';

export default function CreditNotesHistoryPage() {
    const { baseCurrency } = useSettings();
    const tCommon = useTranslations('common');
    const tStates = useTranslations('common.states');
    useDocumentTitle('Credit Notes Ledger');

    const handleRowClicked = useCallback((row: any) => {
        // Future feature: show credit note details
    }, []);

    const gridEndpoint = `/api/sales-credit-notes`;
    
    const gridColumns: any[] = [
        { field: 'creditNoteId', headerName: 'ID', hide: true },
        { field: 'creditNoteNumber', headerName: 'CN Number', width: 180 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 160, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<any>) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 200 },
        { field: 'totalAmount', headerName: 'Total Credit', type: 'numericColumn', width: 150,
            valueGetter: (params: import("ag-grid-community").ValueFormatterParams<any>) => {
                if (!params.data?.totalAmount) return null;
                return parseFloat(params.data.totalAmount);
            },
            valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<any>) => {
                if (!params.value || params.value === 0) return '—';
                return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
            },
        },
        { 
            field: 'stateCode', 
            headerName: tCommon('columns.state'), 
            width: 140,
            valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<any>) => {
                if (!params.value) return '';
                const s = String(params.value).toLowerCase();
                return tStates.has(s as any) ? tStates(s as any) : String(params.value);
            }
        },
    ];

    return (
        <DataGrid 
            endpoint={gridEndpoint} 
            columns={gridColumns} 
            gridKey="credit-notes-history"
            fetchAll
            rowIdField="creditNoteId"
            onRowClicked={handleRowClicked}
            pageTitle="Credit Notes History"
        />
    );
}
