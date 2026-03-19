'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

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

export default function SuppliersPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tSuppliers = useTranslations('suppliers');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'vendorNumber',
      headerName: tSuppliers('columns.vendorNumber'),
      width: 140,
      pinned: 'left',
    },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'vendorGroup', headerName: tCommon('columns.group'), width: 100, hide: true },
    { field: 'address1Line1', headerName: tCommon('columns.address'), width: 180, hide: true },
    { field: 'address1Line2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'address1City', headerName: tCommon('columns.city'), width: 130 },
    { field: 'address1StateOrProvince', headerName: tCommon('columns.state'), width: 90, hide: true },
    { field: 'address1PostalCode', headerName: tCommon('columns.postalCode'), width: 110, hide: true },
    { field: 'address1Country', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone1', headerName: tCommon('columns.phone'), width: 140 },
    { field: 'fax', headerName: tCommon('columns.fax'), width: 120, hide: true },
    { field: 'emailAddress1', headerName: tCommon('columns.email'), width: 200 },
    { field: 'paymentTerms', headerName: tSuppliers('columns.paymentTerms'), width: 130, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 110,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        return <span className={`badge badge-${params.value}`}>{tCommon(`states.${params.value}`)}</span>;
      },
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
    { field: 'productCount', headerName: tSuppliers('columns.productCount'), width: 100, type: 'numericColumn', hide: true },
    {
      field: 'source',
      headerName: tCommon('columns.source'),
      width: 90,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        const label = params.value === 'abm' ? tCommon('sources.abm') : tCommon('sources.app');
        return <span className={`badge badge-${params.value}`}>{label}</span>;
      },
    },
  ], [tCommon, tSuppliers]);

  const handleRowClicked = useCallback((supplier: UnifiedSupplierRow) => {
    router.push(`/suppliers/${supplier.vendorId}`);
  }, [router]);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tSuppliers('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {tSuppliers('subtitle')}
          </p>
        </div>
        <Link href="/suppliers/new" className="btn btn-secondary btn-sm">
          {tSuppliers('buttons.createSupplier')}
        </Link>
      </div>
      <DataGrid<UnifiedSupplierRow>
        endpoint="/api/suppliers"
        columns={columns}
        gridKey="suppliers"
        searchPlaceholder={tSuppliers('placeholders.searchSuppliers')}
        exportFileName="suppliers"
        fetchAll
        showArchivedToggle
        onRowClicked={(row) => router.push(`/suppliers/${encodeURIComponent(row.vendorId)}`)}
      />
    </Shell>
  );
}
