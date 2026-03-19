'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function AccountsPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tAccounts = useTranslations('accounts');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'accountNumber', headerName: tAccounts('columns.accountNumber'), width: 120, pinned: 'left' },
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
    { field: 'customerGroup', headerName: tCommon('columns.group'), width: 100 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 90,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        return <span className={`badge badge-${params.value}`}>{tCommon(`states.${params.value}`)}</span>;
      },
    },
    { field: 'gstPosition', headerName: tCommon('columns.gstPosition'), width: 110, hide: true },
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
      field: 'groupDiscount',
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
    router.push(`/accounts/${row.accountId}`);
  }, [router]);

  return (
    <Shell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{tAccounts('title')}</h2>
        <Link href="/accounts/new" className="btn btn-secondary btn-sm">
          {tAccounts('buttons.createAccount')}
        </Link>
      </div>
      <DataGrid
        endpoint="/api/accounts"
        columns={columns}
        gridKey="ops-accounts"
        searchPlaceholder={tAccounts('placeholders.searchAccounts')}
        exportFileName="accounts"
        fetchAll
        showArchivedToggle
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
