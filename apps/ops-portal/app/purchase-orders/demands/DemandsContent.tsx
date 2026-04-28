'use client';

import { useMemo, useState, useCallback } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

interface DemandRow {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: string;
  createdOn: string;
}

export default function DemandsContent() {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = useMemo<ColDef<DemandRow>[]>(() => [
    {
      field: 'orderNumber',
      headerName: 'Sales Order',
      width: 140,
      pinned: 'left',
    },
    { field: 'productName', headerName: 'Product', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: 'Required Qty', width: 140, cellDataType: 'number' },
    {
      field: 'createdOn',
      headerName: 'Date Requested',
      width: 140,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
  ], []);

  const handleResolveDemands = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/allocations/resolve', { method: 'POST' });
      toast.success('Demand allocation engine run successfully');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      reportError(err, 'DemandsContent');
      toast.error('Failed to resolve demands');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative p-4 lg:p-6">
      <div className="relative h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid<DemandRow>
            // We use refreshKey to force a refetch after resolving
            endpoint={`/api/allocations/open?refresh=${refreshKey}`}
            columns={columns}
            gridKey="open-demands"
            searchPlaceholder="Search demands..."
            exportFileName="open-demands"
            fetchAll
            rowIdField="id"
            renderHeader={({ searchInput, optionsButton, rowCount, loading: gridLoading }) => (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tPurchase('demandTitle')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tCommon('grid.rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {gridLoading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex-1 ml-4 max-w-[280px]">
                    {searchInput}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {optionsButton}
                  <button 
                    onClick={handleResolveDemands} 
                    disabled={loading || rowCount === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? tPurchase('buttons.resolving') : tPurchase('buttons.resolveDemands')}
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
