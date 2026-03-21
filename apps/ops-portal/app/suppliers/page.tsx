'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

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
        return <StateBadge state={params.value as ValidState} />;
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
    <div className="h-full flex flex-col relative" style={{ margin: "-2rem", padding: "2rem" }}>
      <Shell>
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedSupplierRow>
              endpoint="/api/suppliers"
              columns={columns}
              gridKey="suppliers"
              searchPlaceholder={tSuppliers('placeholders.searchSuppliers')}
              exportFileName="suppliers"
              fetchAll
              showArchivedToggle
              onRowClicked={(row) => router.push(`/suppliers/${encodeURIComponent(row.vendorId)}`)}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col shrink-0">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tSuppliers('title')}
                      </h2>
                      {tSuppliers('subtitle') && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{tSuppliers('subtitle')}</p>
                      )}
                    </div>
                    <div className="h-8 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                      <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Rows
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
                    {optionsButton}
                    <Link href="/suppliers/new" className="px-5 py-2 text-sm font-semibold rounded-lg transition-all" style={{ background: '#006b5c', color: '#ffffff', boxShadow: '0 4px 14px 0 rgba(0, 107, 92, 0.39)' }}>
                      {tSuppliers('buttons.createSupplier')}
                    </Link>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </Shell>
    </div>
  );
}
