'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'accountNumber', headerName: 'Account #', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'address1Line1', headerName: 'Address', width: 180, hide: true },
  { field: 'address1Line2', headerName: 'Address 2', width: 150, hide: true },
  { field: 'address1City', headerName: 'City', width: 130 },
  { field: 'address1StateOrProvince', headerName: 'State', width: 90 },
  { field: 'address1PostalCode', headerName: 'Postal Code', width: 110, hide: true },
  { field: 'address1Country', headerName: 'Country', width: 100 },
  { field: 'telephone1', headerName: 'Phone', width: 130 },
  { field: 'fax', headerName: 'Fax', width: 120, hide: true },
  { field: 'emailAddress1', headerName: 'Email', width: 200 },
  { field: 'primaryContactName', headerName: 'Contact', width: 150 },
  { field: 'primaryContactEmail', headerName: 'Contact Email', width: 200, hide: true },
  { field: 'primaryContactPhone', headerName: 'Contact Phone', width: 140, hide: true },
  { field: 'customerGroup', headerName: 'Group', width: 100 },
  {
    field: 'stateCode',
    headerName: 'Status',
    width: 90,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      return <span className={`badge badge-${params.value}`}>{params.value}</span>;
    },
  },
  { field: 'gstPosition', headerName: 'GST Position', width: 110, hide: true },
  { field: 'currencyCode', headerName: 'Currency', width: 90 },
  {
    field: 'createdOn',
    headerName: 'Created',
    width: 110,
    hide: true,
    valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
  },
  { field: 'deliveryAddressCount', headerName: 'Delivery Addrs', width: 120, type: 'numericColumn', hide: true },
  { field: 'priceScale', headerName: 'Price Scale', width: 100, type: 'numericColumn', hide: true },
  {
    field: 'groupDiscount',
    headerName: 'Group Disc %',
    width: 110,
    type: 'numericColumn',
    hide: true,
    valueFormatter: (p: any) => p.value != null ? `${parseFloat(p.value).toFixed(1)}%` : '—',
  },
  {
    field: 'customerDiscount',
    headerName: 'Discount %',
    width: 110,
    type: 'numericColumn',
    valueFormatter: (p: any) => p.value != null ? `${parseFloat(p.value).toFixed(1)}%` : '—',
  },
];

export default function AccountsPage() {
  const router = useRouter();

  const handleRowClicked = useCallback((row: any) => {
    router.push(`/accounts/${row.accountId}`);
  }, [router]);

  return (
    <Shell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Accounts</h2>
        <Link href="/accounts/new" className="btn btn-secondary btn-sm">
          + Create Account
        </Link>
      </div>
      <DataGrid
        endpoint="/api/accounts"
        columns={columns}
        searchPlaceholder="Search by name, account number, or email…"
        exportFileName="accounts"
        fetchAll
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
