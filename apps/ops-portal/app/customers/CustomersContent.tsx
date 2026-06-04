'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
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
    { field: 'address1Line1', headerName: tCommon('columns.address'), width: 180, hide: true },
    { field: 'address1Line2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'address1City', headerName: tCommon('columns.city'), width: 130 },
    { field: 'address1StateOrProvince', headerName: tCommon('columns.state'), width: 90 },
    { field: 'address1PostalCode', headerName: tCommon('columns.postalCode'), width: 110, hide: true },
    { field: 'address1Country', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone1', headerName: tCommon('columns.phone'), width: 130 },
    { field: 'fax', headerName: tCommon('columns.fax'), width: 120, hide: true },
    { field: 'emailAddress1', headerName: tCommon('columns.email'), width: 200 },
    { field: 'primaryContactName', headerName: tCommon('columns.contact'), width: 150 },
    { field: 'primaryContactEmail', headerName: tCommon('columns.contactEmail'), width: 200, hide: true },
    { field: 'primaryContactPhone', headerName: tCommon('columns.contactPhone'), width: 140, hide: true },
    { field: 'accountGroupName', headerName: tCommon('columns.group'), width: 100 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as any) ? tStates(s as any) : String(params.value);
      }
    },
    { field: 'TaxCategoryName', headerName: tCommon('columns.taxPosition'), width: 110, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
    { field: 'deliveryAddressCount', headerName: tCommon('columns.deliveryAddrs'), width: 120, type: 'numericColumn', hide: true },
    { field: 'priceScale', headerName: tCommon('columns.priceScale'), width: 100, type: 'numericColumn', hide: true },
    {
      field: 'accountGroupDiscount',
      headerName: tCommon('columns.groupDisc'),
      width: 110,
      type: 'numericColumn',
      hide: true,
      valueFormatter: (p: any) => p.value != null ? `${parseFloat(p.value).toFixed(1)}%` : '—',
    },
    {
      field: 'customerDiscount',
      headerName: tCommon('columns.disc'),
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? `${parseFloat(p.value).toFixed(1)}%` : '—',
    },
  ], [tCommon, tAccounts]);

  const handleRowClicked = useCallback((row: any) => {
    router.push(`/customers/${row.customerId}`);
  }, [router]);

  return (
    <DataGrid
      endpoint="/api/customers"
      columns={columns}
      gridKey="ops-customers"
      searchPlaceholder={tAccounts('placeholders.searchAccounts')}
      exportFileName="customers"
      fetchAll
      showArchivedToggle
      rowIdField="customerId"
      onRowClicked={handleRowClicked}
      pageTitle={tAccounts('title')}
      headerActions={
        <Link href="/customers/new" className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
          {tAccounts('buttons.createCustomer')}
        </Link>
      }
    />
  );
}
