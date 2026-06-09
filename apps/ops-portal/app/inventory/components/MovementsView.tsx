'use client';

import { useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function MovementsView() {
  const tCommon = useTranslations('common');
  const tInventory = useTranslations('inventory');
  
  const [days, setDays, isReady] = usePersistedFilter('movements-days', '30');

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
    {
      field: 'onHand',
      headerName: tInventory('columns.onHand'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '0',
      cellStyle: () => ({ fontWeight: 'bold', color: '#041627' })
    },
  ], [tCommon, tInventory]);

  return (
    <>
      <DataGrid
        endpoint={isReady ? `/api/inventory/movements?days=${days}` : undefined}
        columns={columns}
        gridKey="ops-inventory-movements"
        searchPlaceholder={tInventory('placeholders.searchMovements')}
        exportFileName="inventory-movements"
        fetchAll
        pageTitle={tInventory('tabs.movements')}
        headerFilters={
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 150 }}
          >
            <option value={7}>{tInventory('filters.last7Days')}</option>
            <option value={30}>{tInventory('filters.last30Days')}</option>
            <option value={90}>{tInventory('filters.last90Days')}</option>
          </select>
        }
      />
    </>
  );
}
