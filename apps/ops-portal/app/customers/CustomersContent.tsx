'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@herobm/shared';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';


export default function CustomersContent() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tAccounts = useTranslations('customers');
  const tStates = useTranslations('common.states');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'customerNumber', headerName: tAccounts('columns.customerNumber'), width: 120, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'billingAddressLine1', headerName: tCommon('columns.address'), width: 180 },
    { field: 'billingAddressLine2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'billingAddressCity', headerName: tCommon('columns.city'), width: 130 },
    { field: 'billingAddressStateOrProvince', headerName: tCommon('columns.state'), width: 90 },
    { field: 'billingAddressPostalCode', headerName: tCommon('columns.postalCode'), width: 110 },
    { field: 'billingAddressCountry', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone', headerName: tAccounts('columns.telephone'), width: 130 },
    { field: 'email', headerName: tAccounts('columns.email'), width: 200 },
    { field: 'salesContactName', headerName: tAccounts('columns.salesContact'), width: 180 },
    { field: 'accountsContactName', headerName: tAccounts('columns.accountsContact'), width: 180 },
    { field: 'customerGroupName', headerName: tCommon('columns.group'), width: 100 },
    {
      colId: 'status',
      headerName: tCommon('columns.status'),
      width: 120,
      valueGetter: (params: { data?: { stateCode?: unknown, isSalesBlocked?: boolean } }) => {
        if (!params.data) return '';
        if (params.data.isSalesBlocked) return tCommon('columns.creditHold');
        if (!params.data.stateCode) return '';
        const s = String(params.data.stateCode).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.data.stateCode);
      }
    },
    { field: 'TaxCategoryName', headerName: tCommon('columns.taxPosition'), width: 110, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    {
      field: 'uninvoicedOrdersTotal',
      headerName: tAccounts('columns.uninvoicedOrders'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: { value?: number, data?: { currencyCode?: string } }) => 
        p.value != null ? formatAmount(p.value, p.data?.currencyCode || 'USD') : '—',
    },
    {
      field: 'totalOutstanding',
      headerName: tAccounts('columns.outstandingBalance'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: { value?: number, data?: { currencyCode?: string } }) => 
        p.value != null ? formatAmount(p.value, p.data?.currencyCode || 'USD') : '—',
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: { value?: string | number | Date }) => formatLocalDate(p.value),
    },
    { field: 'deliveryAddressCount', headerName: tCommon('columns.deliveryAddrs'), width: 120, type: 'numericColumn', hide: true },
    { field: 'priceScale', headerName: tCommon('columns.priceScale'), width: 100, type: 'numericColumn', hide: true },
    {
      field: 'accountGroupDiscount',
      headerName: tCommon('columns.groupDisc'),
      width: 110,
      type: 'numericColumn',
      hide: true,
      valueFormatter: (p: { value?: string | number }) => p.value != null ? `${parseFloat(String(p.value)).toFixed(1)}%` : '—',
    },
    {
      field: 'customerDiscount',
      headerName: tCommon('columns.disc'),
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p: { value?: string | number }) => p.value != null ? `${parseFloat(String(p.value)).toFixed(1)}%` : '—',
    },
  ], [tCommon, tAccounts]);



  return (
    <DataGrid
      endpoint="/api/customers"
      columns={columns}
      gridKey="ops-customers"
      searchPlaceholder={tAccounts('placeholders.searchAccounts')}
      exportFileName="customers"
      showArchivedToggle
      rowIdField="customerId"
      rowHref={(row) => `/customers/${row.customerId}`}
      pageTitle={tAccounts('title')}
      defaultSortModel={[{ colId: 'customerNumber', sort: 'asc' }]}
      headerActions={
        <Button asChild variant="primary">
          <Link href="/customers/new">
            {tAccounts('buttons.createCustomer')}
          </Link>
        </Button>
      }
    />
  );
}
