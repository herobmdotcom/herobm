'use client';

import { useMemo, useState } from 'react';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import LedgerEntrySlideOver from './LedgerEntrySlideOver';

export default function LedgerView() {
  const tCommon = useTranslations('common');
  const tInventory = useTranslations('inventory');
  
  const [days, setDays] = useState<number>(30);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const columns = useMemo<ColDef[]>(() => [
    { 
      field: 'date', 
      headerName: tCommon('columns.date'), 
      width: 160, 
      pinned: 'left',
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString() : ''
    },
    { 
      field: 'document', 
      headerName: tInventory('columns.document', { fallback: 'Document' }), 
      width: 180,
      cellStyle: { fontWeight: '600', color: 'var(--accent)' }
    },
    { 
      field: 'sourceType', 
      headerName: tInventory('columns.sourceType', { fallback: 'Type' }), 
      width: 140 
    },
    { 
      field: 'productNumber', 
      headerName: tInventory('columns.productNumber'), 
      width: 150 
    },
    { 
      field: 'productName', 
      headerName: tCommon('columns.name'), 
      flex: 1, 
      minWidth: 200 
    },
    { 
      field: 'change', 
      headerName: tInventory('columns.qtyChange', { fallback: 'Qty Change' }), 
      width: 140, 
      type: 'numericColumn',
      cellStyle: (params) => {
        const val = parseFloat(params.value || '0');
        if (val > 0) return { color: '#006b5c', fontWeight: 'bold' };
        if (val < 0) return { color: '#b45309', fontWeight: 'bold' };
        return { fontWeight: '500' } as any;
      },
      valueFormatter: (p: any) => {
        const val = parseFloat(p.value || '0');
        return val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString();
      }
    },
    {
      field: 'onHand',
      headerName: tInventory('columns.onHand', { fallback: 'On Hand' }),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '0',
      cellStyle: () => ({ fontWeight: 'bold', color: '#041627' })
    },
    { 
      field: 'actor', 
      headerName: tInventory('columns.actor', { fallback: 'Actor' }), 
      width: 150 
    },
  ], [tCommon, tInventory]);

  return (
    <>
      <DataGrid
        endpoint={`/api/inventory/ledger?days=${days}`}
        columns={columns}
        gridKey="ops-inventory-ledger"
        searchPlaceholder={tInventory('placeholders.searchLedger', { fallback: 'Search transactions...' })}
        exportFileName="inventory-ledger"
        fetchAll
        pageTitle={tInventory('tabs.ledger', { fallback: 'Ledger' })}
        headerFilters={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input text-sm"
            style={{ minWidth: 150 }}
          >
            <option value={1}>{tInventory('filters.last24Hours', { fallback: 'Last 24 Hours' })}</option>
            <option value={7}>{tInventory('filters.last7Days')}</option>
            <option value={30}>{tInventory('filters.last30Days')}</option>
            <option value={90}>{tInventory('filters.last90Days')}</option>
          </select>
        }
        onRowClicked={(row: unknown) => setSelectedEntryId((row as { entryId: string }).entryId)}
      />

      <LedgerEntrySlideOver
        entryId={selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
      />
    </>
  );
}
