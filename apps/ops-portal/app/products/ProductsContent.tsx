'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import ProductImage from '@/components/products/ProductImage';
import { formatLocalDate } from '@/lib/date';
import { hasPermission, PRODUCT_STATE, SystemResource } from '@herobm/shared';
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';
import { useProductGroups, useTaxCategories } from '@/hooks/useReferenceData';
import BulkEditSlideOver, { type BulkEditFieldDef } from '@/components/shared/BulkEditSlideOver';
import ProductPricingSlideOver from '@/components/shared/ProductPricingSlideOver';
import * as api from '@herobm/sdk';

interface ProductGridRow {
  productId: string;
  productNumber: string;
  name?: string;
  [key: string]: unknown;
}

export default function ProductsContent() {
  const { permissions } = useAuth();
  const canBulkWrite = hasPermission(permissions, SystemResource.BULK_WRITE, 'write');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductGridRow[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedPricingProduct, setSelectedPricingProduct] = useState<{
    productId: string;
    productNumber: string;
    name?: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { productGroups } = useProductGroups();
  const { taxCategories } = useTaxCategories();

  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products');
  const tStates = useTranslations('common.states');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'imagePath',
      headerName: tProducts('columns.image'),
      width: 65,
      sortable: false,
      filter: false,
      pinned: 'left',
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center justify-center h-full py-1">
          <ProductImage
            imagePath={params.value as string | null}
            alt={params.data?.name as string}
            size="xs"
            className="w-7 h-7"
          />
        </div>
      ),
    },
    { field: 'productNumber', headerName: tProducts('columns.productNumber'), width: 130, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'alternateProductNumber', headerName: tProducts('columns.alternateProductNumber'), width: 140 },
    { 
      field: 'productType', 
      headerName: tCommon('columns.type'), 
      width: 150,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '';
        const pt = String(params.value);
        if (pt === 'inventory') return tProducts('types.inventory');
        if (pt === 'non-stock') return tProducts('types.nonStock');
        if (pt === 'service') return tProducts('types.service');
        if (pt === 'freight') return tProducts('types.freight');
        return pt;
      }
    },
    { 
      field: 'structureType', 
      headerName: tProducts('structureType'), 
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '';
        const st = String(params.value);
        if (st === 'standard') return tProducts('structures.standard');
        if (st === 'kit') return tProducts('structures.kit');
        return st;
      }
    },
    { field: 'quantityOnHand', headerName: tProducts('columns.quantityOnHand'), width: 130, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value ? parseFloat(p.value as string).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0' },
    { field: 'productGroupName', headerName: tCommon('columns.group'), width: 160 },
    { field: 'defaultVendorName', headerName: tProducts('columns.vendor'), width: 160, hide: true },
    { field: 'standardCost', headerName: tProducts('columns.stdCost'), width: 100, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'listPrice', headerName: tProducts('columns.listPrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'tradePrice', headerName: tProducts('columns.tradePrice'), width: 110, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'priceLevel3', headerName: tProducts('columns.priceLevel3'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    { field: 'priceLevel4', headerName: tProducts('columns.priceLevel4'), width: 100, type: 'numericColumn', hide: true,
      valueFormatter: (p: ValueFormatterParams) => p.value && parseFloat(p.value as string) > 0 ? `$${parseFloat(p.value as string).toFixed(2)}` : '—' },
    {
      colId: 'pricingHistory',
      headerName: tProducts('columns.pricingHistory'),
      width: 120,
      sortable: false,
      filter: false,
      onCellClicked: (params) => {
        params.event?.stopPropagation();
      },
      cellRenderer: (params: ICellRendererParams<ProductGridRow>) => {
        if (!params.data?.productId) return null;
        return (
          <div
            className="flex items-center justify-center h-full py-1"
            data-no-row-click="true"
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
            }}
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-no-row-click="true"
              className="!text-xs !py-0.5 !px-2.5 h-7"
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                setSelectedPricingProduct({
                  productId: params.data!.productId,
                  productNumber: params.data!.productNumber,
                  name: params.data!.name,
                });
              }}
              title={tProducts('columns.pricingHistory')}
            >
              <span>{tProducts('buttons.viewHistory')}</span>
            </Button>
          </div>
        );
      },
    },
    { field: 'barcode', headerName: tProducts('columns.barcode'), width: 130 },
    { field: 'purchaseTaxCategoryId', headerName: tProducts('columns.purchaseTaxCategory'), width: 120, hide: true },
    { field: 'salesTaxCategoryId', headerName: tProducts('columns.salesTaxCategory'), width: 120, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
      }
    },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    { field: 'createdBy', headerName: tCommon('columns.createdBy'), width: 120, hide: true },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: ValueFormatterParams) => formatLocalDate(p.value as string),
    },
  ], [tCommon, tProducts, tStates]);

  const gridColumns = useMemo<ColDef[]>(() => {
    if (!isBulkMode) return columns;
    const checkboxCol: ColDef = {
      colId: '__select',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      resizable: false,
      sortable: false,
      filter: false,
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
    };
    return [checkboxCol, ...columns];
  }, [isBulkMode, columns]);

  const bulkFields = useMemo<BulkEditFieldDef[]>(() => [
    {
      key: 'productGroupId',
      label: tCommon('columns.group'),
      type: 'select',
      nullable: true,
      options: productGroups.map((g) => ({
        label: g.name,
        value: g.productGroupId,
      })),
      placeholder: 'Select Product Group...',
    },
    {
      key: 'salesTaxCategoryId',
      label: tProducts('columns.salesTaxCategory'),
      type: 'select',
      nullable: true,
      options: taxCategories.map((tc) => ({
        label: tc.title || tc.code,
        value: tc.taxCategoryId,
      })),
      placeholder: 'Select Sales Tax Category...',
    },
    {
      key: 'purchaseTaxCategoryId',
      label: tProducts('columns.purchaseTaxCategory'),
      type: 'select',
      nullable: true,
      options: taxCategories.map((tc) => ({
        label: tc.title || tc.code,
        value: tc.taxCategoryId,
      })),
      placeholder: 'Select Purchase Tax Category...',
    },
    {
      key: 'stateCode',
      label: tCommon('columns.status'),
      type: 'select',
      nullable: false,
      options: [
        { label: tCommon('states.active'), value: PRODUCT_STATE.ACTIVE },
        { label: tCommon('states.inactive'), value: PRODUCT_STATE.INACTIVE },
        { label: tCommon('states.discontinued'), value: PRODUCT_STATE.DISCONTINUED },
        { label: tCommon('states.archived'), value: PRODUCT_STATE.ARCHIVED },
      ],
      placeholder: 'Select Status...',
    },
  ], [productGroups, taxCategories, tCommon, tProducts]);

  const handleBulkApply = async (payload: Record<string, unknown>) => {
    const ids = selectedProducts.map((p) => p.productId);
    const res = await api.productsControllerBulkUpdate({
      ids,
      ...payload,
    });
    setRefreshTrigger((prev) => prev + 1);
    setSelectedProducts([]);
    setIsBulkMode(false);
    return res.data;
  };

  return (
    <>
      <DataGrid
        endpoint="/api/products"
        columns={gridColumns}
        customFieldEntityType="products"
        gridKey="ops-products"
        searchPlaceholder={tProducts('placeholders.searchProducts')}
        exportFileName="products"
        showArchivedToggle
        rowIdField="productId"
        rowSelection={isBulkMode ? 'multiple' : 'single'}
        fetchAll={isBulkMode}
        onSelectionChanged={isBulkMode ? (rows) => setSelectedProducts(rows as ProductGridRow[]) : undefined}
        rowHref={isBulkMode ? undefined : (row: Record<string, unknown>) => `/products/${row.productId as string}`}
        pageTitle={tProducts('title')}
        defaultSortModel={[{ colId: 'productNumber', sort: 'asc' }]}
        refreshTrigger={refreshTrigger}
        headerActions={
          <div className="flex items-center gap-2">
            {canBulkWrite && (
              <Button
                type="button"
                variant={isBulkMode ? 'secondary' : 'ghost'}
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedProducts([]);
                }}
              >
                {isBulkMode ? tCommon('bulkEdit.exit') : tCommon('bulkEdit.toggle')}
              </Button>
            )}
            <Button asChild variant="primary">
              <Link href="/products/new">
                {tProducts('buttons.addProduct')}
              </Link>
            </Button>
          </div>
        }
        secondaryHeader={
          isBulkMode ? (
            <div className="flex items-center gap-3 py-1">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                {tCommon('bulkEdit.selectedCount', { count: selectedProducts.length })}
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedProducts.length === 0}
                onClick={() => setIsBulkOpen(true)}
              >
                {tCommon('bulkEdit.editSelected', { count: selectedProducts.length })}
              </Button>
            </div>
          ) : undefined
        }
      />

      {isBulkOpen && (
        <BulkEditSlideOver
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          entityName={tProducts('title')}
          selectedCount={selectedProducts.length}
          fields={bulkFields}
          onApply={handleBulkApply}
        />
      )}

      {selectedPricingProduct && (
        <ProductPricingSlideOver
          isOpen={Boolean(selectedPricingProduct)}
          onClose={() => setSelectedPricingProduct(null)}
          productId={selectedPricingProduct.productId}
          productNumber={selectedPricingProduct.productNumber}
          productDescription={selectedPricingProduct.name}
        />
      )}
    </>
  );
}
