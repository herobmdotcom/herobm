'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import DataGrid from '@/components/DataGrid';
import { toInputDateFormat } from '@/lib/date';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import MovementDetailSlideOver from './MovementDetailSlideOver';
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';

export interface MovementBreakdownDto {
  poReceipts: number;
  soShipments: number;
  customerReturns: number;
  supplierReturns: number;
  adjustments: number;
  transfersIn: number;
  transfersOut: number;
  workOrders: number;
}

export interface MovementItemDto {
  productId: string;
  productNumber: string;
  productName: string;
  productGroupId?: string | null;
  productGroupName?: string | null;
  baseUom: string;
  locationId?: string | null;
  locationName?: string | null;
  locationCode?: string | null;
  openingQuantity: number;
  stockIn: number;
  stockOut: number;
  netMovement: number;
  closingQuantity: number;
  currentOnHand: number;
  breakdown: MovementBreakdownDto;
}

export interface MovementLedgerLineDto {
  ledgerId: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  sourceType: string;
  productId: string;
  productNumber: string;
  productName: string;
  productGroupId?: string | null;
  productGroupName?: string | null;
  locationId: string;
  locationName: string;
  locationCode: string;
  binId: string;
  binNumber: string;
  quantity: number;
  memo?: string | null;
  createdBy?: string | null;
}

interface LocationOption {
  locationId: string;
  code: string;
  name: string;
}

interface ProductGroupOption {
  productGroupId: string;
  groupCode: string;
  name: string;
}

function computeDateRange(days: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = toInputDateFormat(now);
  if (days === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toInputDateFormat(start), endDate };
  }
  const numDays = parseInt(days, 10);
  if (numDays > 0) {
    const start = new Date(now.getTime() - numDays * 24 * 60 * 60 * 1000);
    return { startDate: toInputDateFormat(start), endDate };
  }
  return { startDate: '1970-01-01', endDate };
}

export default function MovementContent() {
  const t = useTranslations('demand.movement');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));

  const [days, setDays, isDaysReady] = usePersistedFilter('movement-days', '30');
  const [productGroupId, setProductGroupId, isGroupReady] = usePersistedFilter('movement-group', 'all');
  const [locationId, setLocationId, isLocReady] = usePersistedFilter('movement-location', 'all');

  const isReady = isDaysReady && isGroupReady && isLocReady;

  const [productGroups, setProductGroups] = useState<ProductGroupOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [, setLoading] = useState(false);

  const [data, setData] = useState<MovementItemDto[]>([]);
  const [movements, setMovements] = useState<MovementLedgerLineDto[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MovementItemDto | null>(null);

  // Load locations and product groups
  useEffect(() => {
    api.inventoryControllerFindAllLocations()
      .then((res) => setLocations((res?.data as unknown as LocationOption[]) || []))
      .catch((err) => reportError(err, 'MovementContent:loadLocations'));

    api.productGroupsControllerFindAll()
      .then((res) => {
        const raw = res?.data as unknown as { data?: ProductGroupOption[] } | ProductGroupOption[];
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setProductGroups(list);
      })
      .catch((err) => reportError(err, 'MovementContent:loadProductGroups'));
  }, []);

  const { startDate, endDate } = useMemo(() => computeDateRange(days), [days]);

  const fetchData = useCallback(() => {
    if (!isReady) return;
    const { startDate: sDate, endDate: eDate } = computeDateRange(days);
    setLoading(true);

    api.inventoryControllerGetMovement({
      startDate: sDate,
      endDate: eDate,
      productGroupId: productGroupId && productGroupId !== 'all' ? productGroupId : undefined,
      locationId: locationId && locationId !== 'all' ? locationId : undefined,
    })
      .then((res) => {
        const payload = res.data as unknown as {
          data: MovementItemDto[];
          movements: MovementLedgerLineDto[];
        };
        setData(payload?.data || []);
        setMovements(payload?.movements || []);
      })
      .catch((err) => reportError(err, 'MovementContent:fetchMovementData'))
      .finally(() => setLoading(false));
  }, [days, isReady, productGroupId, locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Product summary columns
  const summaryColumns = useMemo<ColDef<MovementItemDto>[]>(
    () => [
      {
        field: 'productNumber',
        headerName: t('columns.product'),
        width: 170,
        pinned: 'left',
        cellRenderer: (params: ICellRendererParams<MovementItemDto>) => {
          if (!params.data) return null;
          return (
            <Link
              href={routes.products.detail(params.data.productId)}
              className="text-[#006b5c] dark:text-emerald-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {params.value}
            </Link>
          );
        },
      },
      {
        field: 'productName',
        headerName: t('columns.description'),
        flex: 2,
        minWidth: 180,
      },
      {
        field: 'productGroupName',
        headerName: t('columns.group'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) => p.value || '—',
      },
      {
        field: 'baseUom',
        headerName: t('columns.uom'),
        width: 80,
        cellClass: 'text-center font-mono text-xs',
      },
      {
        field: 'openingQuantity',
        headerName: t('columns.openingStock'),
        width: 130,
        cellClass: 'font-mono text-right',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'stockIn',
        headerName: t('columns.stockIn'),
        width: 120,
        cellClass: 'font-mono text-right text-emerald-600 dark:text-emerald-400 font-semibold',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) =>
          `+${Number(p.value ?? 0).toLocaleString()}`,
      },
      {
        field: 'stockOut',
        headerName: t('columns.stockOut'),
        width: 120,
        cellClass: 'font-mono text-right text-rose-600 dark:text-rose-400 font-semibold',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) =>
          `-${Number(p.value ?? 0).toLocaleString()}`,
      },
      {
        field: 'netMovement',
        headerName: t('columns.netMovement'),
        width: 130,
        cellClass: 'font-mono text-right font-bold',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) => {
          const val = Number(p.value ?? 0);
          return val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString();
        },
        cellStyle: (p) => {
          const val = Number(p.value ?? 0);
          if (val > 0) return { color: 'var(--emerald-600, #059669)' };
          if (val < 0) return { color: 'var(--danger, #e11d48)' };
          return undefined;
        },
      },
      {
        field: 'closingQuantity',
        headerName: t('columns.closingStock'),
        width: 130,
        cellClass: 'font-mono text-right font-semibold text-[var(--text-primary)]',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'currentOnHand',
        headerName: t('columns.currentOnHand'),
        width: 130,
        cellClass: 'font-mono text-right text-[var(--text-secondary)]',
        valueFormatter: (p: ValueFormatterParams<MovementItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
    ],
    [t]
  );

  const headerFilters = (
    <div className="flex items-center gap-2">
      {/* Product Group Filter */}
      <select
        value={productGroupId}
        onChange={(e) => setProductGroupId(e.target.value)}
        className="input text-sm min-w-[160px]"
        aria-label={t('filterGroup')}
      >
        <option value="all">{t('allProductGroups')}</option>
        {productGroups.map((g) => (
          <option key={g.productGroupId} value={g.productGroupId}>
            {g.groupCode} - {g.name}
          </option>
        ))}
      </select>

      {/* Location Filter */}
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className="input text-sm min-w-[160px]"
        aria-label={t('filterLocation')}
      >
        <option value="all">{t('allLocations')}</option>
        {locations.map((loc) => (
          <option key={loc.locationId} value={loc.locationId}>
            {loc.code} - {loc.name}
          </option>
        ))}
      </select>

      {/* Date Range Filter */}
      <select
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="input text-sm min-w-[130px]"
        aria-label="Date Range Filter"
      >
        <option value="mtd">{tCommon('filters.monthToDate')}</option>
        <option value="30">{tCommon('filters.last30Days')}</option>
        <option value="90">{tCommon('filters.last90Days')}</option>
        <option value="365">{tCommon('filters.last1Year')}</option>
        <option value="0">{tCommon('filters.allTime')}</option>
      </select>
    </div>
  );

  return (
    <>
      <DataGrid<MovementItemDto>
        rowData={data}
        columns={summaryColumns}
        gridKey="demand-movement-summary-grid"
        pageTitle={t('title')}
        searchPlaceholder={t('searchPlaceholder')}
        exportFileName={`stock-movement-summary_${startDate}_${endDate}`}
        fetchAll
        rowIdField="productId"
        onRowClicked={(row) => setSelectedProduct(row)}
        headerFilters={headerFilters}
      />

      <MovementDetailSlideOver
        product={selectedProduct}
        movements={movements}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}
