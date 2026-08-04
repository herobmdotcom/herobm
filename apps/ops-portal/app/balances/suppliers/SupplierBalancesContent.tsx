'use client';

import { useEffect, useState, useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import { useRouter } from 'next/navigation';
import * as api from '@herobm/sdk';
import type { ColDef } from 'ag-grid-community';
import { reportError } from '@/lib/api';
import { calculateAgedTotals } from '@herobm/shared';

export default function SupplierBalancesContent() {
  const router = useRouter();
  const [balances, setBalances] = useState<api.SupplierAgedBalanceResponseDto[]>([]);
  const [quickFilter, setQuickFilter] = useState<string>('all');
  const [agingBasis, setAgingBasis] = useState<'invoiceDate' | 'dueDate'>('dueDate');
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalances = async (basis: 'invoiceDate' | 'dueDate') => {
    setIsLoading(true);
    try {
      const response = await api.suppliersControllerGetAgedBalances({ agingBasis: basis });
      setBalances(response.data);
    } catch (error) {
      reportError(error, 'SupplierBalancesContent_fetchBalances');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances(agingBasis);
  }, [agingBasis]);

  const columns = useMemo<ColDef<api.SupplierAgedBalanceResponseDto>[]>(() => [
    { field: 'supplierNumber', headerName: 'Supplier No.', width: 120 },
    { field: 'supplierName', headerName: 'Supplier Name', flex: 1, minWidth: 200 },
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
      field: 'isPaymentBlocked',
      headerName: 'Payment Block',
      width: 130,
      cellRenderer: (params: { value: boolean }) => {
        if (params.value) {
          return <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--danger)] text-white">Blocked</span>;
        }
        return '';
      },
    },
    {
      field: 'glBalance',
      headerName: 'GL Balance',
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
      field: 'discrepancyAmount',
      headerName: 'Discrepancy',
      width: 150,
      type: 'numericColumn',
      cellStyle: (params) => {
        if (params.value && params.value > 0.01) {
          return { color: 'var(--danger)', fontWeight: 'bold' };
        }
        return { color: 'var(--success)', fontWeight: 'normal' };
      },
      valueFormatter: (params) => formatAmount(params.value, params.data?.currencyCode || 'USD'),
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
  ], []);

  const filteredBalances = useMemo(() => {
    if (quickFilter === 'all') return balances;
    if (quickFilter === 'discrepancy') return balances.filter((b) => b.discrepancyAmount > 0.01);
    if (quickFilter === 'overdue') return balances.filter((b) => b.totalOutstanding - b.current > 0.01);
    if (quickFilter === 'blocked') return balances.filter((b) => b.isPaymentBlocked);
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
      rowSelection="multiple"
      pageTitle="Supplier Balances"
      loading={isLoading}
      hideSearch={true}
      rowHref={(row) => `/suppliers/${row.supplierId}?tab=invoices`}
      headerActions={
        <div className="flex items-center gap-3">
          <select
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 160 }}
          >
            <option value="all">All Suppliers</option>
            <option value="discrepancy">Has Discrepancy</option>
            <option value="overdue">Overdue Only</option>
            <option value="blocked">Payment Blocked</option>
          </select>
          <select
            value={agingBasis}
            onChange={(e) => setAgingBasis(e.target.value as 'invoiceDate' | 'dueDate')}
            className="input text-sm"
            style={{ minWidth: 150 }}
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
