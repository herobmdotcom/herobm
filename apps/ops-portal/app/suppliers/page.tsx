'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

interface UnifiedSupplierRow {
  vendorId: string;
  vendorNumber: string;
  name: string;
  emailAddress1: string;
  telephone1: string;
  address1City: string;
  address1Country: string;
  currencyCode: string;
  stateCode: string;
  source: 'abm' | 'app';
}

const columns: ColDef[] = [
  {
    field: 'vendorNumber',
    headerName: 'Supplier #',
    width: 140,
    pinned: 'left',
  },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'vendorGroup', headerName: 'Group', width: 100, hide: true },
  { field: 'address1Line1', headerName: 'Address', width: 180, hide: true },
  { field: 'address1Line2', headerName: 'Address 2', width: 150, hide: true },
  { field: 'address1City', headerName: 'City', width: 130 },
  { field: 'address1StateOrProvince', headerName: 'State', width: 90, hide: true },
  { field: 'address1PostalCode', headerName: 'Postal Code', width: 110, hide: true },
  { field: 'address1Country', headerName: 'Country', width: 100 },
  { field: 'telephone1', headerName: 'Phone', width: 140 },
  { field: 'fax', headerName: 'Fax', width: 120, hide: true },
  { field: 'emailAddress1', headerName: 'Email', width: 200 },
  { field: 'paymentTerms', headerName: 'Payment Terms', width: 130, hide: true },
  { field: 'currencyCode', headerName: 'Currency', width: 90 },
  { field: 'notes', headerName: 'Notes', width: 150, hide: true },
  {
    field: 'stateCode',
    headerName: 'Status',
    width: 110,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      return <span className={`badge badge-${params.value}`}>{params.value}</span>;
    },
  },
  {
    field: 'createdOn',
    headerName: 'Created',
    width: 110,
    hide: true,
    valueFormatter: (params: { value: unknown }) => {
      if (!params.value) return '—';
      return new Date(params.value as string).toLocaleDateString();
    },
  },
  { field: 'productCount', headerName: 'Products', width: 100, type: 'numericColumn', hide: true },
  {
    field: 'source',
    headerName: 'Source',
    width: 90,
    cellRenderer: (params: { value: string }) => {
      if (!params.value) return null;
      const label = params.value === 'abm' ? 'ABM' : 'App';
      return <span className={`badge badge-${params.value}`}>{label}</span>;
    },
  },
];

export default function SuppliersPage() {
  const router = useRouter();

  const handleRowClicked = useCallback((supplier: UnifiedSupplierRow) => {
    router.push(`/suppliers/${supplier.vendorId}`);
  }, [router]);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage supplier records
          </p>
        </div>
        <Link href="/suppliers/new" className="btn btn-secondary btn-sm">
          + Create Supplier
        </Link>
      </div>
      <DataGrid<UnifiedSupplierRow>
        endpoint="/api/suppliers"
        columns={columns}
        gridKey="suppliers"
        searchPlaceholder="Search suppliers…"
        exportFileName="suppliers"
        fetchAll
        onRowClicked={handleRowClicked}
      />
    </Shell>
  );
}
