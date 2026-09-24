'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import RestockGeneratePOsSlideOver, { RestockItemWithQty } from './RestockGeneratePOsSlideOver';
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';

export interface RestockItemDto {
  id: string;
  productId: string;
  productNumber: string;
  productName: string;
  productDescription?: string | null;
  productGroupId?: string | null;
  productGroupName?: string | null;
  productGroupCode?: string | null;
  productType: string;
  baseUom: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  binId: string;
  binNumber: string;
  binType: string;
  zoneCode?: string | null;
  zoneName?: string | null;
  quantityOnHand: number;
  quantityCommitted: number;
  quantityOnOrder: number;
  availableQuantity: number;
  minQuantity: number;
  maxQuantity?: number | null;
  suggestedRestockQty: number;
  vendorId?: string | null;
  vendorName?: string | null;
  costPrice?: number | null;
  currencyCode?: string | null;
  minPurchaseQty?: number | null;
  purchaseUnit?: string | null;
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

export default function RestockContent() {
  const t = useTranslations('demand.restock');

  const [locationId, setLocationId] = useState<string>('all');
  const [productGroupId, setProductGroupId] = useState<string>('all');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroupOption[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRows, setSelectedRows] = useState<RestockItemDto[]>([]);
  const [allDataItems, setAllDataItems] = useState<RestockItemDto[]>([]);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Load locations and product groups for filter dropdowns
  useEffect(() => {
    api.inventoryControllerFindAllLocations()
      .then((res) => setLocations((res?.data as unknown as LocationOption[]) || []))
      .catch((err) => reportError(err, 'RestockContent:loadLocations'));

    api.productGroupsControllerFindAll()
      .then((res) => {
        const raw = res?.data as unknown as { data?: ProductGroupOption[] } | ProductGroupOption[];
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setProductGroups(list);
      })
      .catch((err) => reportError(err, 'RestockContent:loadProductGroups'));
  }, []);

  const endpointUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (locationId && locationId !== 'all') {
      params.set('locationId', locationId);
    }
    if (productGroupId && productGroupId !== 'all') {
      params.set('productGroupId', productGroupId);
    }
    const queryStr = params.toString();
    return `/api/inventory/restock${queryStr ? `?${queryStr}` : ''}`;
  }, [locationId, productGroupId]);

  // Fetch full items list for when user clicks Auto-Generate without checking specific boxes
  const fetchAllRestockItems = useCallback(async () => {
    try {
      const res = await api.inventoryControllerGetRestock({
        locationId: locationId && locationId !== 'all' ? locationId : undefined,
        productGroupId: productGroupId && productGroupId !== 'all' ? productGroupId : undefined,
      });
      const payload = res.data as unknown as {
        data: RestockItemDto[];
      };
      if (payload?.data) {
        setAllDataItems(payload.data);
      }
    } catch (err) {
      reportError(err, 'RestockContent:fetchAllRestockItems');
      toast.error(getErrorMessage(err));
    }
  }, [locationId, productGroupId]);

  useEffect(() => {
    fetchAllRestockItems();
  }, [fetchAllRestockItems, refreshKey]);

  const columns = useMemo<ColDef<RestockItemDto>[]>(
    () => [
      {
        field: 'productNumber',
        headerName: t('columns.product'),
        width: 170,
        pinned: 'left',
        checkboxSelection: true,
        headerCheckboxSelection: true,
        cellRenderer: (params: ICellRendererParams<RestockItemDto>) => {
          if (!params.data) return null;
          return (
            <Link
              href={routes.products.detail(params.data.productId)}
              className="text-[#006b5c] dark:text-emerald-400 hover:underline"
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
        width: 140,
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) => p.value || '—',
      },
      {
        field: 'locationName',
        headerName: t('columns.location'),
        width: 140,
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          p.data ? `${p.data.locationCode} (${p.data.locationName})` : '',
      },
      {
        field: 'binNumber',
        headerName: t('columns.primaryBin'),
        width: 110,
        cellClass: 'font-mono text-xs',
      },
      {
        field: 'quantityOnHand',
        headerName: t('columns.onHand'),
        width: 100,
        cellClass: 'font-mono text-right',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'quantityOnOrder',
        headerName: t('columns.onOrder'),
        width: 100,
        cellClass: 'font-mono text-right text-[var(--text-muted)]',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'minQuantity',
        headerName: t('columns.minQty'),
        width: 95,
        cellClass: 'font-mono text-right font-medium text-amber-600 dark:text-amber-400',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'maxQuantity',
        headerName: t('columns.maxQty'),
        width: 95,
        cellClass: 'font-mono text-right text-[var(--text-secondary)]',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          p.value !== null && p.value !== undefined ? Number(p.value).toLocaleString() : '—',
      },
      {
        field: 'suggestedRestockQty',
        headerName: t('columns.suggestedRestock'),
        width: 130,
        cellClass: 'font-mono text-right font-bold text-emerald-600 dark:text-emerald-400',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          Number(p.value ?? 0).toLocaleString(),
      },
      {
        field: 'vendorName',
        headerName: t('columns.supplier'),
        width: 170,
        cellRenderer: (params: ICellRendererParams<RestockItemDto>) => {
          if (!params.data) return null;
          return (
            <Link
              href={routes.products.detail(params.data.productId, { tab: 'suppliers' })}
              className="text-[#006b5c] dark:text-emerald-400 hover:underline"
            >
              {params.value || t('unassigned')}
            </Link>
          );
        },
      },
      {
        field: 'costPrice',
        headerName: t('columns.unitCost'),
        width: 105,
        cellClass: 'font-mono text-right',
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          p.value !== null && p.value !== undefined
            ? `$${Number(p.value).toFixed(2)}`
            : '—',
      },
      {
        headerName: t('columns.estimatedCost'),
        width: 125,
        cellClass: 'font-mono text-right font-semibold',
        valueGetter: (params) => {
          if (!params.data) return 0;
          const qty = params.data.suggestedRestockQty || 0;
          const unitCost = params.data.costPrice || 0;
          return qty * unitCost;
        },
        valueFormatter: (p: ValueFormatterParams<RestockItemDto>) =>
          `$${Number(p.value ?? 0).toFixed(2)}`,
      },
    ],
    [t]
  );

  const itemsForSlideOver = useMemo<RestockItemWithQty[]>(() => {
    const sourceList = selectedRows.length > 0 ? selectedRows : allDataItems;
    return sourceList.map((row) => ({
      ...row,
      restockQty: row.suggestedRestockQty,
    }));
  }, [selectedRows, allDataItems]);

  const handleOpenSlideOver = () => {
    if (itemsForSlideOver.length === 0) {
      toast.error(t('selectItemsToRestockError'));
      return;
    }
    setIsSlideOverOpen(true);
  };

  const handleSlideOverSuccess = () => {
    setIsSlideOverOpen(false);
    setSelectedRows([]);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <DataGrid<RestockItemDto>
        refreshTrigger={refreshKey}
        endpoint={endpointUrl}
        columns={columns}
        gridKey="demand-restock-grid"
        pageTitle={t('title')}
        searchPlaceholder={t('searchPlaceholder')}
        exportFileName="inventory-restock-requisition"
        fetchAll
        rowIdField="id"
        rowSelection="multiple"
        onSelectionChanged={setSelectedRows}
        headerFilters={
          <div className="flex items-center gap-2">
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
          </div>
        }
        headerActions={
          <Button
            variant="primary"
            onClick={handleOpenSlideOver}
          >
            {t('generatePOs')}
          </Button>
        }
      />

      <RestockGeneratePOsSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        items={itemsForSlideOver}
        onSuccess={handleSlideOverSuccess}
      />
    </>
  );
}
