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
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      }
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
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          {/* Removed aggressive background blur gradients */}
        
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid
            endpoint="/api/accounts"
            columns={columns}
            gridKey="ops-accounts"
            searchPlaceholder={tAccounts('placeholders.searchAccounts')}
            exportFileName="accounts"
            fetchAll
            showArchivedToggle
            onRowClicked={handleRowClicked}
            renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tAccounts('title')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tAccounts('totalAccounts')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {loading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Search Bar natively rendered inside header row */}
                  <div className="flex-1 ml-6 max-w-md">
                    {searchInput}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {optionsButton}
                  <Link href="/accounts/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                    {tAccounts('buttons.createAccount')}
                  </Link>
                </div>
              </div>
            )}
          />
        </div>
        </div>
      </div>
    </Shell>
  );
}
