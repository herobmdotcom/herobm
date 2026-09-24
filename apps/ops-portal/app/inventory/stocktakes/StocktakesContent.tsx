'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';
import CreateStocktakeSlideOver from './CreateStocktakeSlideOver';
import type { StocktakeResponseDto } from '@herobm/sdk';
import { STOCKTAKE_STATE } from '@herobm/shared';

export default function StocktakesContent() {
  const router = useRouter();
  const t = useTranslations('stocktakes');
  const tTable = useTranslations('stocktakes.table');
  const tStates = useTranslations('stocktakes.states');
  const tScopes = useTranslations('stocktakes.scopes');
  const tCommon = useTranslations('common');

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [gridRefresher, setGridRefresher] = useState(0);

  const columns = useMemo<ColDef<StocktakeResponseDto>[]>(() => [
    {
      field: 'stocktakeNumber',
      headerName: tTable('stocktakeNumber'),
      width: 160,
      pinned: 'left',
    },
    {
      field: 'name',
      headerName: tTable('name'),
      flex: 1.5,
      minWidth: 180,
    },
    {
      field: 'locationName',
      headerName: tTable('location'),
      width: 150,
    },
    {
      field: 'stateCode',
      headerName: tTable('status'),
      width: 120,
      valueFormatter: (params: { value?: unknown }) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        type StateKey = 'draft' | 'open' | 'review' | 'submitted' | 'cancelled';
        return tStates.has(s as StateKey) ? tStates(s as StateKey) : String(params.value);
      },
    },
    {
      field: 'scopeType',
      headerName: tTable('scope'),
      width: 180,
      valueGetter: (params: { data?: StocktakeResponseDto }) => {
        if (!params.data) return '';
        const s = params.data.scopeType;
        type ScopeKey = 'full' | 'zone' | 'bin_pattern' | 'manual';
        const label = tScopes.has(s as ScopeKey) ? tScopes(s as ScopeKey) : s;
        if (s === 'bin_pattern' && params.data.binPattern) {
          return `${label} (${params.data.binPattern})`;
        }
        if (s === 'zone' && params.data.zoneFilter) {
          return `${label} (${params.data.zoneFilter})`;
        }
        return label;
      },
    },
    {
      field: 'isBlindCount',
      headerName: tTable('blind'),
      width: 90,
      valueFormatter: (params: { value?: boolean }) => {
        return params.value ? tCommon('yes') : tCommon('no');
      },
    },
    {
      field: 'progressPercentage',
      headerName: tTable('progress'),
      width: 140,
      valueGetter: (params: { data?: StocktakeResponseDto }) => {
        if (!params.data) return '0%';
        const { progressPercentage = 0, countedLines = 0, totalLines = 0 } = params.data;
        return `${progressPercentage}% (${countedLines}/${totalLines})`;
      },
    },
    {
      field: 'discrepancyLines',
      headerName: tTable('discrepancies'),
      width: 120,
      valueFormatter: (params: { value?: number }) => {
        return String(params.value ?? 0);
      },
    },
    {
      field: 'createdOn',
      headerName: tTable('created'),
      width: 120,
      valueFormatter: (params: { value: unknown }) => {
        return formatLocalDate(params.value as string);
      },
    },
    {
      field: 'createdBy',
      headerName: tTable('createdBy'),
      width: 130,
    },
  ], [tTable, tStates, tScopes, tCommon]);

  return (
    <>
      <DataGrid<StocktakeResponseDto>
        key={gridRefresher}
        endpoint="/inventory/stocktakes"
        columns={columns}
        gridKey="inventory-stocktakes-list"
        searchPlaceholder="Search stocktake no, name, notes..."
        exportFileName="stocktakes"
        rowIdField="stocktakeId"
        rowHref={(stk) => routes.inventory.stocktakes.detail(stk.stocktakeId)}
        pageTitle={t('title')}
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        headerActions={
          <Button
            variant="primary"
            onClick={() => setIsSlideOverOpen(true)}
            className="ml-2 lg:ml-0"
          >
            {t('createNew')}
          </Button>
        }
      />

      <CreateStocktakeSlideOver
        open={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={(id) => {
          setGridRefresher((r) => r + 1);
          if (id) {
            router.push(routes.inventory.stocktakes.detail(id));
          }
        }}
      />
    </>
  );
}
