'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';



export default function GlobalInvoicesPage() {
    const t = useTranslations('salesOrders');
    const tCommon = useTranslations('common');
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceFilter = searchParams.get('invoice') || '';
    const [days, setDays] = useState('0');

    const handleRowClicked = useCallback((row: any) => {
        if (row.salesOrderId) {
            router.push(`/sales-orders/${row.salesOrderId}?source=app#invoices-section`);
        }
    }, [router]);

    // When filtering by specific invoiceId, pass it to the API (server skips date range)
    const gridEndpoint = invoiceFilter
        ? `/api/sales-invoices?invoiceId=${encodeURIComponent(invoiceFilter)}&limit=0`
        : `/api/sales-invoices?days=${days}&limit=0`;
    const gridColumns: any[] = [
        { field: 'invoiceId', headerName: 'ID', hide: true },
        { field: 'invoiceNumber', headerName: t('columns.invoiceNumber', { defaultValue: 'Invoice No.' }), width: 180 },
        { field: 'orderNumber', headerName: t('columns.orderNumber', { defaultValue: 'Order No.' }), width: 160 },
        { field: 'customerName', headerName: t('columns.customer', { defaultValue: 'Customer' }), width: 250 },
        { field: 'createdOn', headerName: t('columns.date', { defaultValue: 'Date' }), width: 200, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'totalAmount', headerName: t('columns.amount', { defaultValue: 'Amount' }), type: 'numericColumn', width: 150,
            valueGetter: (params: any) => {
                if (!params.data?.totalAmount) return null;
                return parseFloat(params.data.totalAmount);
            },
            valueFormatter: (params: any) => {
                if (!params.value || params.value === 0) return '—';
                return formatAmount(params.value, params.data?.currencyCode || 'EUR');
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
        <>
            <div className="h-full flex flex-col relative p-4 lg:p-6">
                <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
                    <DataGrid 
                        endpoint={gridEndpoint} 
                        columns={gridColumns} 
                        gridKey="global-invoices"
                        fetchAll
                        onRowClicked={handleRowClicked}
                        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                            <div className="flex items-center justify-between px-6 py-4">
                                <div className="flex items-center gap-4 flex-1">
                                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                        {t('invoicesCardHeading', { defaultValue: 'Sales Invoices' })}
                                    </h2>
                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            {tCommon('grid.rowCountLabel')}
                                        </span>
                                        <span className="text-[11px] font-bold text-[#006b5c]">
                                            {loading ? '...' : rowCount.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 ml-4 max-w-md">
                                        {searchInput}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0 ml-4">
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
                                    {optionsButton}
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
        </>
    );
}
