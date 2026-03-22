'use client';

import { useMemo, useState } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function MovementsView() {
  const tCommon = useTranslations('common');
  const tInventory = useTranslations('inventory');
  
  const [days, setDays] = useState<number>(30);

  const columns = useMemo<ColDef[]>(() => [
    { field: 'productNumber', headerName: tInventory('columns.productNumber'), width: 150, pinned: 'left' },
    { field: 'productName', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { 
      field: 'stockIn', 
      headerName: tInventory('columns.stockIn'), 
      width: 140, 
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '0'
    },
    { 
      field: 'stockOut', 
      headerName: tInventory('columns.stockOut'), 
      width: 140, 
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '0'
    },
    { 
      field: 'netChange', 
      headerName: tInventory('columns.netChange'), 
      width: 140, 
      type: 'numericColumn',
      cellStyle: (params) => {
        const val = parseFloat(params.value || '0');
        if (val > 0) return { color: '#006b5c', fontWeight: 'bold' };
        if (val < 0) return { color: '#b45309', fontWeight: 'bold' };
        return undefined;
      },
      valueFormatter: (p: any) => {
        const val = parseFloat(p.value || '0');
        return val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString();
      }
    },
  ], [tCommon, tInventory]);

  return (
    <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
      <DataGrid
        endpoint={`/api/inventory/movements?days=${days}`}
        columns={columns}
        gridKey="ops-inventory-movements"
        searchPlaceholder={tInventory('placeholders.searchMovements')}
        exportFileName="inventory-movements"
        fetchAll
        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {tInventory('tabs.movements')}
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
              
              <div className="flex-1 ml-4 max-w-md">
                {searchInput}
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="input input-sm"
                style={{ height: 32, fontSize: 13 }}
              >
                <option value={7}>{tInventory('filters.last7Days')}</option>
                <option value={30}>{tInventory('filters.last30Days')}</option>
                <option value={90}>{tInventory('filters.last90Days')}</option>
              </select>
              {optionsButton}
            </div>
          </div>
        )}
      />
    </div>
  );
}
