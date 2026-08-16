'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import { useRouter } from 'next/navigation';
import * as api from '@herobm/sdk';
import type { ColDef } from 'ag-grid-community';
import { reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { calculateAgedTotals } from '@herobm/shared';

export default function BalancesContent() {
  const router = useRouter();
  const [quickFilter, setQuickFilter] = useState<string>('all');
  const [agingBasis, setAgingBasis] = useState<'invoiceDate' | 'dueDate'>('dueDate');
  const t = useTranslations('common');
  const tStates = useTranslations('common.states');
  const tAccounts = useTranslations('customers');

  const { data: balances = [], isLoading } = useSWR(
    ['customers-aged-balances', agingBasis],
    async () => {
      const response = await api.customersControllerGetAgedBalances({ agingBasis });
      const rawData = response.data as unknown;
      return (Array.isArray(rawData) ? rawData : (rawData as { data?: api.AgedBalanceResponseDto[] })?.data || []) as api.AgedBalanceResponseDto[];
    },
    {
      keepPreviousData: true,
      onError: (error) => reportError(error, 'BalancesContent_fetchBalances'),
    }
  );

  const columns = useMemo<ColDef<api.AgedBalanceResponseDto>[]>(() => [
    { field: 'customerNumber', headerName: 'Account No.', width: 120 },
    { field: 'customerName', headerName: 'Customer Name', flex: 1, minWidth: 200 },
    {
      colId: 'status',
      headerName: t('columns.status'),
      width: 120,
      valueGetter: (params) => {
        if (!params.data) return '';
        if (params.data.isOnCreditHold) return t('columns.creditHold');
        if (!params.data.stateCode) return '';
        const s = String(params.data.stateCode).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.data.stateCode);
      }
    },
    {
      field: 'creditLimit',
      headerName: 'Credit Limit',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => {
        if (params.value == null || params.value === '') {
          return formatAmount(0, params.data?.currencyCode || 'USD');
        }
        return formatAmount(Number(params.value), params.data?.currencyCode || 'USD');
      },
    },
    {
      field: 'current',
      headerName: 'Current',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'days1To30',
      headerName: '1-30 Days',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'days31To60',
      headerName: '31-60 Days',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'days61To90',
      headerName: '61-90 Days',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'days90Plus',
      headerName: '90+ Days',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'totalOutstanding',
      headerName: 'Total Invoices',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'uninvoicedOrdersTotal',
      headerName: tAccounts('columns.uninvoicedOrders'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'glBalance',
      headerName: 'GL Balance',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
    {
      field: 'discrepancyAmount',
      headerName: 'Discrepancy',
      width: 150,
      type: 'numericColumn',
      cellClass: (params) => {
        if (params.value && params.value > 0.01) {
          return 'text-red-500 font-bold';
        }
        return 'text-emerald-500 font-normal';
      },
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
    },
  ], []);

  const filteredBalances = useMemo(() => {
    if (quickFilter === 'all') return balances;
    if (quickFilter === 'discrepancy') return balances.filter((b) => b.discrepancyAmount > 0.01);
    if (quickFilter === 'overdue') return balances.filter((b) => b.totalOutstanding - b.current > 0.01);
    if (quickFilter === 'overLimit') {
      return balances.filter((b) => {
        if (!b.creditLimit) return false;
        return b.totalOutstanding > Number(b.creditLimit);
      });
    }
    return balances;
  }, [balances, quickFilter]);

  const totals = useMemo(() => {
    return calculateAgedTotals(filteredBalances);
  }, [filteredBalances]);

  const defaultCurrency = balances.length > 0 ? balances[0].currencyCode || 'USD' : 'USD';

  return (
    <DataGrid
      columns={columns}
      rowData={filteredBalances}
      loading={isLoading}
      rowSelection="multiple"
      pageTitle="Balances"
      searchPlaceholder={tAccounts('balancesSearchPlaceholder')}
      defaultSortModel={[{ colId: 'customerNumber', sort: 'asc' }]}
      rowHref={(row) => `/customers/${row.customerId}?tab=invoices`}
      headerActions={
        <div className="flex items-center gap-3">
          <select
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            className="input text-sm min-w-[160px]"
          >
            <option value="all">All Accounts</option>
            <option value="discrepancy">Has Discrepancy</option>
            <option value="overdue">Overdue Only</option>
            <option value="overLimit">Over Credit Limit</option>
          </select>
          <select
            value={agingBasis}
            onChange={(e) => setAgingBasis(e.target.value as 'invoiceDate' | 'dueDate')}
            className="input text-sm min-w-[150px]"
          >
            <option value="dueDate">By Due Date</option>
            <option value="invoiceDate">By Invoice Date</option>
          </select>
        </div>
      }
      secondaryHeader={
        <div className="flex flex-wrap items-center gap-6 pb-1 w-full">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Outstanding</span>
            <span className="text-sm">{formatAmount(totals.totalOutstanding, defaultCurrency)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Current</span>
            <span className="text-sm">{formatAmount(totals.current, defaultCurrency)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">1-30 Days</span>
            <span className="text-sm">{formatAmount(totals.days1To30, defaultCurrency)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">31-60 Days</span>
            <span className="text-sm">{formatAmount(totals.days31To60, defaultCurrency)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">61-90 Days</span>
            <span className="text-sm">{formatAmount(totals.days61To90, defaultCurrency)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">90+ Days</span>
            <span className="text-sm">{formatAmount(totals.days90Plus, defaultCurrency)}</span>
          </div>
        </div>
      }
    />
  );
}
