'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';



export default function GlobalInvoicesPage() {
  const { baseCurrency } = useSettings();
    const t = useTranslations('salesOrders');
    const tCommon = useTranslations('common');
    const tStates = useTranslations('common.states');
    useDocumentTitle(t('invoicesCardHeading'));
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceFilter = searchParams.get('invoice') || '';
    const [days, setDays] = useState('90');

    const handleRowClicked = useCallback((row: any) => {
        if (row.invoiceId) {
            router.push(`/sales-invoices/${row.invoiceId}`);
        }
    }, [router]);

    // When filtering by specific invoiceId, pass it to the API (server skips date range)
    const gridEndpoint = invoiceFilter
        ? `/api/sales-invoices?invoiceId=${encodeURIComponent(invoiceFilter)}&limit=0`
        : `/api/sales-invoices?days=${days}&limit=0`;
    const gridColumns: any[] = [
        { field: 'invoiceId', headerName: 'ID', hide: true },
        { field: 'invoiceNumber', headerName: t('columns.invoiceNumber'), width: 180 },
        { field: 'orderNumber', headerName: t('columns.orderNumber'), width: 160 },
        { field: 'customerName', headerName: t('columns.customer'), width: 250 },
        { field: 'createdOn', headerName: t('columns.date'), width: 200, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<any>) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'totalAmount', headerName: t('columns.amount'), type: 'numericColumn', width: 150,
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
            headerName: t('columns.state'), 
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
            gridKey="global-invoices"
            fetchAll
            rowIdField="invoiceId"
            onRowClicked={handleRowClicked}
            pageTitle={t('invoicesCardHeading')}
            headerFilters={
                <select
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="input text-sm"
                    style={{ minWidth: 150 }}
                >
                    <option value="30">{tCommon('filters.last30Days')}</option>
                    <option value="90">{tCommon('filters.last90Days')}</option>
                    <option value="365">{tCommon('filters.last1Year')}</option>
                    <option value="0">{tCommon('filters.allTime')}</option>
                </select>
            }
        />
    );
}
