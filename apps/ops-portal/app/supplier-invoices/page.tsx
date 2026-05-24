'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';
import { useSettings } from '@/components/SettingsProvider';

export default function GlobalPurchaseInvoicesPage() {
    const { baseCurrency } = useSettings();
    const t = useTranslations('purchaseOrders');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('supplierInvoicesCardHeading', { defaultValue: 'Supplier Invoices' }));
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceFilter = searchParams.get('invoiceId') || '';
    const [days, setDays] = useState('90');

    const handleRowClicked = useCallback((row: any) => {
        if (row.invoiceId) {
            router.push(`/supplier-invoices/${row.invoiceId}`);
        }
    }, [router]);

    // When filtering by specific invoiceId, pass it to the API (server skips date range)
    const gridEndpoint = invoiceFilter
        ? `/api/purchase-invoices?invoiceId=${encodeURIComponent(invoiceFilter)}&limit=0`
        : `/api/purchase-invoices?days=${days}&limit=0`;

    const gridColumns: any[] = [
        { field: 'invoiceId', headerName: 'ID', hide: true },
        { field: 'invoiceNumber', headerName: t('columns.invoiceNumber', { defaultValue: 'System Bill No.' }), width: 180 },
        { field: 'supplierInvoiceNumber', headerName: t('columns.supplierInvoiceNumber', { defaultValue: 'Supplier Invoice No.' }), width: 220 },
        { field: 'vendorName', headerName: t('columns.vendor', { defaultValue: 'Supplier' }), width: 250 },
        { field: 'createdOn', headerName: t('columns.date', { defaultValue: 'Date' }), width: 200, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { 
            field: 'totalAmount', 
            headerName: t('columns.amount', { defaultValue: 'Amount' }), 
            type: 'numericColumn', 
            width: 150,
            valueGetter: (params: any) => {
                if (!params.data?.totalAmount) return null;
                return parseFloat(params.data.totalAmount);
            },
            valueFormatter: (params: any) => {
                if (!params.value || params.value === 0) return '—';
                return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
            },
        },
        { 
            field: 'stateCode', 
            headerName: t('columns.state', { defaultValue: 'State' }), 
            width: 140,
            cellRenderer: (params: { value: string }) => {
                if (!params.value) return null;
                return <StateBadge state={params.value as ValidState} />;
            }
        },
    ];

    return (
        <DataGrid 
            endpoint={gridEndpoint} 
            columns={gridColumns} 
            gridKey="global-purchase-invoices"
            fetchAll
            rowIdField="invoiceId"
            onRowClicked={handleRowClicked}
            pageTitle={t('supplierInvoicesCardHeading', { defaultValue: 'Supplier Invoices' })}
            headerFilters={
                <select
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="input text-sm"
                    style={{ minWidth: 150 }}
                >
                    <option value="30">{tCommon('filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
                    <option value="90">{tCommon('filters.last90Days', { defaultValue: 'Last 90 Days' })}</option>
                    <option value="365">{tCommon('filters.last1Year', { defaultValue: 'Last 1 Year' })}</option>
                    <option value="0">{tCommon('filters.allTime', { defaultValue: 'All Time' })}</option>
                </select>
            }
            headerActions={
                <button
                    className="btn btn-primary whitespace-nowrap ml-2 lg:ml-0"
                    onClick={() => router.push('/supplier-invoices/new')}
                >
                    {t('buttons.enterSupplierBill', { defaultValue: 'Enter Supplier Bill' })}
                </button>
            }
        />
    );
}
