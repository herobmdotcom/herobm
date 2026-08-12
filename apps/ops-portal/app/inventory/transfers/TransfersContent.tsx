'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import CreateTransferSlideOver from './CreateTransferSlideOver';

interface UnifiedTransferOrderRow {
  id: string;
  transferOrderId?: string;
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
  const tStates = useTranslations('common.states');
  
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
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        return tStates.has(s as any) ? tStates(s as any) : String(params.value);
      },
    },
    { field: 'notes', headerName: tTransfers('columns.notes'), width: 200 },
    {
      field: 'createdOn',
      headerName: tTransfers('columns.createdOn'),
      width: 110,
      valueFormatter: (params: { value: unknown }) => {
        return formatLocalDate(params.value as string);
      },
    },
    { field: 'createdBy', headerName: tTransfers('columns.createdBy'), width: 120 },
  ], [tTransfers]);



  return (
    <>
      <>
            <DataGrid<UnifiedTransferOrderRow>
              key={gridRefresher}
              endpoint={`/api/transfers`}
              columns={columns}
              gridKey="transfer-orders"
              searchPlaceholder={tTransfers('placeholders.searchTransfer')}
              exportFileName="transfer-orders"
              showArchivedToggle
              rowIdField="id"
              rowHref={(order) => (order.id || order.transferOrderId) ? `/inventory/transfers/${order.id || order.transferOrderId}` : ''}
              pageTitle={tTransfers('title')}
              defaultSortModel={[{ colId: 'orderNumber', sort: 'desc' }]}
              headerActions={
                <Button 
                  variant="primary"
                  onClick={() => setIsSlideOverOpen(true)}
                  className="ml-2 lg:ml-0"
                >
                  {tTransfers('buttons.createTransfer')}
                </Button>
              }
            />
      </>
      
      <CreateTransferSlideOver
        open={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={() => setGridRefresher(r => r + 1)}
      />
    </>
  );
}
