'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import CreateTransferSlideOver from './CreateTransferSlideOver';

interface UnifiedTransferOrderRow {
  id: string;
  orderNumber: string;
  stateCode: string;
  sourceLocationName: string;
  destinationLocationName: string;
  notes: string | null;
  createdBy: string;
  createdOn: string | null;
}

export default function TransfersContent() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tTransfers = useTranslations('transfers');
  
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [gridRefresher, setGridRefresher] = useState(0);

  const columns = useMemo<ColDef<UnifiedTransferOrderRow>[]>(() => [
    {
      field: 'orderNumber',
      headerName: tTransfers('columns.orderNumber'),
      width: 140,
      pinned: 'left',
    },
    { field: 'sourceLocationName', headerName: tTransfers('columns.sourceLocation'), flex: 1, minWidth: 160 },
    { field: 'destinationLocationName', headerName: tTransfers('columns.destinationLocation'), flex: 1, minWidth: 160 },
    {
      field: 'stateCode',
      headerName: tTransfers('columns.status'),
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      },
    },
    { field: 'notes', headerName: tTransfers('columns.notes'), width: 200 },
    {
      field: 'createdOn',
      headerName: tTransfers('columns.createdOn'),
      width: 110,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
    { field: 'createdBy', headerName: tTransfers('columns.createdBy'), width: 120 },
  ], [tTransfers]);

  const handleRowClicked = useCallback((order: UnifiedTransferOrderRow) => {
    router.push(`/inventory/transfers/${order.id}`);
  }, [router]);

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedTransferOrderRow>
              key={gridRefresher}
              endpoint={`/api/transfers`}
              columns={columns}
              gridKey="transfer-orders"
              searchPlaceholder={tTransfers('placeholders.searchTransfer')}
              exportFileName="transfer-orders"
              fetchAll
              showArchivedToggle
              rowIdField="id"
              onRowClicked={handleRowClicked}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tTransfers('title')}
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
                    {optionsButton}
                    <button 
                      onClick={() => setIsSlideOverOpen(true)}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap"
                    >
                      {tTransfers('buttons.createTransfer')}
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
      
      <CreateTransferSlideOver
        open={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={() => setGridRefresher(r => r + 1)}
      />
    </>
  );
}
