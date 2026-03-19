'use client';

import { useMemo } from 'react';
import Shell from '@/components/Shell';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function BinsPage() {
  const tCommon = useTranslations('common');
  const tBins = useTranslations('bins');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'binNumber', headerName: tBins('columns.bin'), width: 120, pinned: 'left' },
    { field: 'binType', headerName: tBins('columns.binType'), width: 90 },
    { field: 'locationNo', headerName: tBins('columns.locationNo'), width: 110 },
    { field: 'locationName', headerName: tCommon('columns.city'), width: 140 },
    { field: 'productNumber', headerName: tBins('columns.productNumber'), width: 130 },
    { field: 'productName', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'actualQuantity', headerName: tCommon('columns.qty'), width: 90, type: 'numericColumn' },
    { field: 'baseQuantity', headerName: tBins('columns.baseQty'), width: 100, type: 'numericColumn' },
    { field: 'isConsignment', headerName: tBins('columns.consignment'), width: 110 },
    { field: 'isBonded', headerName: tBins('columns.bonded'), width: 90 },
    { field: 'isUnavailable', headerName: tBins('columns.unavailable'), width: 110 },
  ], [tCommon, tBins]);

  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-6">{tBins('title')}</h2>
      <DataGrid
        endpoint="/api/inventory/bins"
        columns={columns}
        gridKey="ops-bins"
        searchPlaceholder={tBins('placeholders.searchBins')}
        exportFileName="bins"
        fetchAll
      />
    </Shell>
  );
}
