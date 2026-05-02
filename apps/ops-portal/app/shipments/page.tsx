'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

export default function ShipmentsPage() {
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [days, setDays] = useState('30');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'shipmentNumber',
      headerName: t('columns.shipmentNumber'),
      width: 150,
      pinned: 'left',
      cellRenderer: (params: any) => (
        <span className="font-semibold text-[var(--text-primary)]">
          {params.value}
        </span>
      ),
    },
    {
      field: 'createdOn',
      headerName: t('columns.date'),
      width: 110,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '—',
    },
    {
      field: 'customerName',
      headerName: t('columns.customer'),
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'orderNumber',
      headerName: t('columns.orderNumber'),
      width: 140,
    },
    {
      field: 'purchaseOrders',
      headerName: t('columns.purchaseOrders'),
      width: 160,
      valueFormatter: (params) => params.value?.join(', ') || '—',
    },
    {
      field: 'stateCode',
      headerName: t('columns.status'),
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      },
    },
    {
      field: 'notes',
      headerName: t('columns.notes'),
      flex: 1.5,
      minWidth: 200,
    },
  ], [t]);

  const handleRowClicked = useCallback((data: any) => {
    router.push(`/shipments/${data.shipmentId}`);
  }, [router]);

  return (
    <div className="h-full flex flex-col relative p-4 lg:p-6">
      <div className="relative h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid
            endpoint={`/api/shipments?days=${days}`}
            columns={columns}
            gridKey="ops-shipments"
            searchPlaceholder={t('placeholders.searchShipments')}
            exportFileName="shipments"
            fetchAll
            rowIdField="shipmentId"
            onRowClicked={handleRowClicked}
            renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {t('title')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tCommon('grid.rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {loading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex-1 ml-4 max-w-[280px]">
                    {searchInput}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <select
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="input text-sm"
                      style={{ minWidth: 150 }}
                  >
                      <option value="30">{tCommon('filters.last30Days')}</option>
                      <option value="90">{tCommon('filters.last90Days')}</option>
                      <option value="365">{tCommon('filters.last1Year')}</option>
                      <option value="0">{tCommon('filters.allTime')}</option>
                  </select>
                  {optionsButton}
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
