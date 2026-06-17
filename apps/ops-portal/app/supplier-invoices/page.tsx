'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';

export default function GlobalPurchaseInvoicesPage() {
    const { baseCurrency } = useSettings();
    const t = useTranslations('purchaseOrders');
    const tCommon = useTranslations('common');
    const tStates = useTranslations('common.states');
    useDocumentTitle(t('supplierInvoicesCardHeading'));
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceFilter = searchParams.get('invoiceId') || '';
    const [days, setDays, isReady] = usePersistedFilter('supplier-invoices-days', '90');

    const handleRowClicked = useCallback((row: { invoiceId?: string }) => {
        if (row.invoiceId) {
            router.push(`/supplier-invoices/${row.invoiceId}`);
        }
    }, [router]);

    // When filtering by specific invoiceId, pass it to the API (server skips date range)
    const gridEndpoint = !isReady ? undefined : (invoiceFilter
        ? `/api/purchase-invoices?invoiceId=${encodeURIComponent(invoiceFilter)}`
        : `/api/purchase-invoices?days=${days}`);

    const gridColumns: Record<string, unknown>[] = [
        { field: 'invoiceId', headerName: 'ID', hide: true },
        { field: 'invoiceNumber', headerName: t('columns.invoiceNumber'), width: 180 },
        { field: 'supplierInvoiceNumber', headerName: t('columns.supplierInvoiceNumber'), width: 220 },
        { field: 'vendorName', headerName: t('columns.vendor'), width: 250 },
        { field: 'createdOn', headerName: t('columns.date'), width: 200, valueFormatter: (p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>) => p.value ? new Date(p.value as string | number).toLocaleDateString() : '' },
        { 
            field: 'totalAmount', 
            headerName: t('columns.amount'), 
            type: 'numericColumn', 
            width: 150,
             
            valueGetter: (params: import("ag-grid-community").ValueFormatterParams<{ totalAmount?: string | number }>) => {
                if (!params.data?.totalAmount) return null;
                return parseFloat(String(params.data.totalAmount));
            },
            valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<{ currencyCode?: string }>) => {
                if (!params.value || params.value === 0) return '—';
                return formatAmount(params.value as number, params.data?.currencyCode || baseCurrency);
            },
        },
        { 
            field: 'stateCode', 
            headerName: t('columns.state'), 
            width: 140,
            valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<Record<string, unknown>>) => {
                if (!params.value) return '';
                const s = String(params.value).toLowerCase();
                return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
            }
        },
    ];

    return (
        <DataGrid 
            endpoint={gridEndpoint} 
            columns={gridColumns} 
            gridKey="global-purchase-invoices"
            rowIdField="invoiceId"
            onRowClicked={handleRowClicked}
            pageTitle={t('supplierInvoicesCardHeading')}
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
            headerActions={
                <button
                    className="btn btn-primary whitespace-nowrap ml-2 lg:ml-0"
                    onClick={() => router.push('/supplier-invoices/new')}
                >
                    {t('buttons.enterSupplierBill')}
                </button>
            }
        />
    );
}
