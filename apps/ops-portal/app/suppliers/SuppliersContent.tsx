'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import { CURRENCIES, hasPermission, SUPPLIER_STATE, SystemResource } from '@herobm/shared';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';
import { useSupplierGroups, useTaxPositions, useTradingTerms } from '@/hooks/useReferenceData';
import BulkEditSlideOver, { type BulkEditFieldDef } from '@/components/shared/BulkEditSlideOver';
import * as api from '@herobm/sdk';

interface UnifiedSupplierRow {
  vendorId: string;
  vendorNumber: string;
  name: string;
  supplierGroupName?: string;
  supplierGroupCode?: string;
  emailAddress1: string;
  telephone1: string;
  address1City: string;
  address1Country: string;
  currencyCode: string;
  stateCode: string;
  isPurchasingBlocked?: boolean;
  groupIsPurchasingBlocked?: boolean;
  isPaymentBlocked?: boolean;
  groupIsPaymentBlocked?: boolean;
}

export default function SuppliersContent() {
  const { permissions } = useAuth();
  const canBulkWrite = hasPermission(permissions, SystemResource.BULK_WRITE, 'write');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<UnifiedSupplierRow[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { supplierGroups } = useSupplierGroups();
  const { tradingTerms } = useTradingTerms();
  const { taxPositions } = useTaxPositions();

  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const tSuppliers = useTranslations('suppliers');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'vendorNumber',
      headerName: tSuppliers('columns.vendorNumber'),
      width: 140,
      pinned: 'left',
    },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'supplierGroupName', headerName: tCommon('columns.group'), width: 130 },
    { field: 'address1Line1', headerName: tCommon('columns.address'), width: 180, hide: true },
    { field: 'address1Line2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'address1City', headerName: tCommon('columns.city'), width: 130 },
    { field: 'address1StateOrProvince', headerName: tCommon('columns.state'), width: 90, hide: true },
    { field: 'address1PostalCode', headerName: tCommon('columns.postalCode'), width: 110, hide: true },
    { field: 'address1Country', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone1', headerName: tCommon('columns.phone'), width: 140 },
    { field: 'fax', headerName: tCommon('columns.fax'), width: 120, hide: true },
    { field: 'emailAddress1', headerName: tCommon('columns.email'), width: 200 },
    { field: 'paymentTerms', headerName: tSuppliers('columns.paymentTerms'), width: 130, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 250,
      valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<UnifiedSupplierRow>) => {
        if (!params.value || !params.data) return '';
        
        const s = String(params.value).toLowerCase();
        let stateText = tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
        
        const blocks = [];
        if (params.data.isPurchasingBlocked || params.data.groupIsPurchasingBlocked) {
            blocks.push('Purchasing Blocked');
        }
        if (params.data.isPaymentBlocked || params.data.groupIsPaymentBlocked) {
            blocks.push('Payment Blocked');
        }
        
        if (blocks.length > 0) {
            stateText += ` (${blocks.join(', ')})`;
        }
        return stateText;
      },
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (params: { value: unknown }) => {
        return formatLocalDate(params.value as string);
      },
    },
    { field: 'productCount', headerName: tSuppliers('columns.productCount'), width: 100, type: 'numericColumn', hide: true },
  ], [tCommon, tStates, tSuppliers]);

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
      key: 'supplierGroupId',
      label: tCommon('columns.group'),
      type: 'select',
      nullable: true,
      options: supplierGroups.map((g) => ({
        label: g.name,
        value: g.supplierGroupId,
      })),
      placeholder: 'Select Supplier Group...',
    },
    {
      key: 'tradingTermsId',
      label: tSuppliers('columns.paymentTerms'),
      type: 'select',
      nullable: true,
      options: tradingTerms.map((tt) => ({
        label: tt.description || tt.code,
        value: tt.tradingTermsId,
      })),
      placeholder: 'Select Trading Terms...',
    },
    {
      key: 'taxPositionId',
      label: tCommon('columns.taxPosition'),
      type: 'select',
      nullable: true,
      options: taxPositions.map((tp) => ({
        label: tp.title || tp.code,
        value: tp.taxPositionId,
      })),
      placeholder: 'Select Tax Position...',
    },
    {
      key: 'currencyCode',
      label: tCommon('columns.currency'),
      type: 'select',
      nullable: false,
      options: CURRENCIES.map((c) => ({
        label: `${c.code} (${c.name})`,
        value: c.code,
      })),
      placeholder: 'Select Currency...',
    },
    {
      key: 'isPurchasingBlocked',
      label: 'Purchasing Blocked',
      type: 'boolean',
      nullable: false,
      helpText: 'Toggle to prevent purchase orders from being placed with selected suppliers.',
    },
    {
      key: 'isPaymentBlocked',
      label: 'Payment Blocked',
      type: 'boolean',
      nullable: false,
      helpText: 'Toggle to prevent outgoing payments to selected suppliers.',
    },
    {
      key: 'stateCode',
      label: tCommon('columns.status'),
      type: 'select',
      nullable: false,
      options: [
        { label: tCommon('states.active'), value: SUPPLIER_STATE.ACTIVE },
        { label: tCommon('states.inactive'), value: SUPPLIER_STATE.INACTIVE },
        { label: tCommon('states.archived'), value: SUPPLIER_STATE.ARCHIVED },
      ],
      placeholder: 'Select Status...',
    },
  ], [supplierGroups, tradingTerms, taxPositions, tCommon, tSuppliers]);

  const handleBulkApply = async (payload: Record<string, unknown>) => {
    const ids = selectedSuppliers.map((s) => s.vendorId);
    const res = await api.suppliersControllerBulkUpdate({
      ids,
      ...payload,
    });
    setRefreshTrigger((prev) => prev + 1);
    setSelectedSuppliers([]);
    setIsBulkMode(false);
    return res.data;
  };

  return (
    <>
      <DataGrid<UnifiedSupplierRow>
        endpoint="/api/suppliers"
        columns={gridColumns}
        customFieldEntityType="suppliers"
        gridKey="suppliers"
        searchPlaceholder={tSuppliers('placeholders.searchSuppliers')}
        exportFileName="suppliers"
        showArchivedToggle
        rowIdField="vendorId"
        rowSelection={isBulkMode ? 'multiple' : 'single'}
        fetchAll={isBulkMode}
        onSelectionChanged={isBulkMode ? (rows) => setSelectedSuppliers(rows) : undefined}
        rowHref={isBulkMode ? undefined : (row) => `/suppliers/${encodeURIComponent(row.vendorId)}`}
        pageTitle={tSuppliers('title')}
        defaultSortModel={[{ colId: 'vendorNumber', sort: 'asc' }]}
        refreshTrigger={refreshTrigger}
        headerActions={
          <div className="flex items-center gap-2">
            {canBulkWrite && (
              <Button
                type="button"
                variant={isBulkMode ? 'secondary' : 'ghost'}
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedSuppliers([]);
                }}
              >
                {isBulkMode ? tCommon('bulkEdit.exit') : tCommon('bulkEdit.toggle')}
              </Button>
            )}
            <Button asChild variant="primary">
              <Link href="/suppliers/new">
                {tSuppliers('buttons.createSupplier')}
              </Link>
            </Button>
          </div>
        }
        secondaryHeader={
          isBulkMode ? (
            <div className="flex items-center gap-3 py-1">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                {tCommon('bulkEdit.selectedCount', { count: selectedSuppliers.length })}
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedSuppliers.length === 0}
                onClick={() => setIsBulkOpen(true)}
              >
                {tCommon('bulkEdit.editSelected', { count: selectedSuppliers.length })}
              </Button>
            </div>
          ) : undefined
        }
      />

      {isBulkOpen && (
        <BulkEditSlideOver
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          entityName={tSuppliers('title')}
          selectedCount={selectedSuppliers.length}
          fields={bulkFields}
          onApply={handleBulkApply}
        />
      )}
    </>
  );
}
