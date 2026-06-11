'use client';

import { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import LedgerEntrySlideOver from './LedgerEntrySlideOver';

function LedgerViewContent() {
  const tCommon = useTranslations('common');
  const tInventory = useTranslations('inventory');
  
  const searchParams = useSearchParams();
  const [days, setDays, isReady] = usePersistedFilter('ledger-days', '30');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(searchParams.get('entryId'));

  const columns = useMemo<ColDef[]>(() => [
    { 
      field: 'date', 
      headerName: tCommon('columns.date'), 
      width: 160, 
      pinned: 'left',
      valueFormatter: (p: { value?: unknown }) => p.value ? new Date(p.value as string).toLocaleString() : ''
    },
    { 
      field: 'document', 
      headerName: tInventory('columns.document'), 
      width: 180,
      cellStyle: { fontWeight: '600', color: 'var(--accent)' }
    },
    { 
      field: 'sourceType', 
      headerName: tInventory('columns.sourceType'), 
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
      headerName: tInventory('columns.qtyChange'), 
      width: 140, 
      type: 'numericColumn',
      cellStyle: (params) => {
        const val = parseFloat(params.value || '0');
        if (val > 0) return { color: '#006b5c', fontWeight: 'bold' };
        if (val < 0) return { color: '#b45309', fontWeight: 'bold' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { fontWeight: '500' } as any;
      },
      valueFormatter: (p: { value?: unknown }) => {
        const val = parseFloat((p.value as string) || '0');
        return val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString();
      }
    },
    {
      field: 'onHand',
      headerName: tInventory('columns.onHand'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: { value?: unknown }) => p.value ? parseFloat(p.value as string).toLocaleString() : '0',
      cellStyle: () => ({ fontWeight: 'bold', color: '#041627' })
    },
    { 
      field: 'actor', 
      headerName: tInventory('columns.actor'), 
      width: 150 
    },
  ], [tCommon, tInventory]);

  return (
    <>
      <DataGrid
        endpoint={isReady ? `/api/inventory/ledger?days=${days}` : undefined}
        columns={columns}
        gridKey="ops-inventory-ledger"
        searchPlaceholder={tInventory('placeholders.searchLedger')}
        exportFileName="inventory-ledger"
        fetchAll
        pageTitle={tInventory('tabs.ledger')}
        headerFilters={
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 150 }}
          >
            <option value={1}>{tInventory('filters.last24Hours')}</option>
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

export default function LedgerView() {
  return (
    <Suspense>
      <LedgerViewContent />
    </Suspense>
  );
}
