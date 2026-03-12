'use client';

import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'accountNumber', headerName: 'Account #', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'address1City', headerName: 'City', width: 130 },
  { field: 'address1StateOrProvince', headerName: 'State', width: 90 },
  { field: 'telephone1', headerName: 'Phone', width: 130 },
  { field: 'emailAddress1', headerName: 'Email', width: 200 },
  { field: 'primaryContactName', headerName: 'Contact', width: 150 },
  { field: 'customerGroup', headerName: 'Group', width: 100 },
  {
    field: 'customerDiscount',
    headerName: 'Discount %',
    width: 110,
    type: 'numericColumn',
    valueFormatter: (p: any) => p.value != null ? `${parseFloat(p.value).toFixed(1)}%` : '—',
  },
  { field: 'stateCode', headerName: 'Status', width: 80 },
];

export default function AccountsPage() {
  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">Accounts</h2>
      <DataGrid
        endpoint="/api/accounts"
        columns={columns}
        searchPlaceholder="Search by name, account number, or email…"
        exportFileName="accounts"
      />
    </Shell>
  );
}
