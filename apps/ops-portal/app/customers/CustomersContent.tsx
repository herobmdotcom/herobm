'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { CURRENCIES, CUSTOMER_STATE, formatAmount, hasPermission, SystemResource } from '@herobm/shared';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';
import { useCustomerGroups, useTaxPositions, useTradingTerms } from '@/hooks/useReferenceData';
import BulkEditSlideOver, { type BulkEditFieldDef } from '@/components/shared/BulkEditSlideOver';
import * as api from '@herobm/sdk';

interface CustomerGridRow {
  customerId: string;
  customerNumber: string;
  name?: string;
  [key: string]: unknown;
}

export default function CustomersContent() {
  const { permissions } = useAuth();
  const canBulkWrite = hasPermission(permissions, SystemResource.BULK_WRITE, 'write');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerGridRow[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { customerGroups } = useCustomerGroups();
  const { tradingTerms } = useTradingTerms();
  const { taxPositions } = useTaxPositions();

  const tCommon = useTranslations('common');
  const tAccounts = useTranslations('customers');
  const tStates = useTranslations('common.states');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'customerNumber', headerName: tAccounts('columns.customerNumber'), width: 120, pinned: 'left' },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    {
      colId: 'status',
      headerName: tCommon('columns.status'),
      width: 120,
      valueGetter: (params: { data?: { stateCode?: unknown, isSalesBlocked?: boolean, isOnCreditHold?: boolean } }) => {
        if (!params.data) return '';
        if (params.data.isSalesBlocked) return tCommon('columns.creditHold');
        if (!params.data.stateCode) return '';
        const s = String(params.data.stateCode).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.data.stateCode);
      }
    },
    { field: 'customerGroupName', headerName: tCommon('columns.group'), width: 100 },
    { field: 'billingAddressLine1', headerName: tCommon('columns.address'), width: 180 },
    { field: 'billingAddressLine2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'billingAddressCity', headerName: tCommon('columns.city'), width: 130 },
    { field: 'billingAddressStateOrProvince', headerName: tCommon('columns.state'), width: 90 },
    { field: 'billingAddressPostalCode', headerName: tCommon('columns.postalCode'), width: 110 },
    { field: 'billingAddressCountry', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone', headerName: tAccounts('columns.telephone'), width: 130 },
    { field: 'email', headerName: tAccounts('columns.email'), width: 200 },
    { field: 'salesContactName', headerName: tAccounts('columns.salesContact'), width: 180 },
    { field: 'accountsContactName', headerName: tAccounts('columns.accountsContact'), width: 180 },
    { field: 'TaxCategoryName', headerName: tCommon('columns.taxPosition'), width: 110, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    {
      field: 'uninvoicedOrdersTotal',
      headerName: tAccounts('columns.uninvoicedOrders'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: { value?: number, data?: { currencyCode?: string } }) => 
        p.value != null ? formatAmount(p.value, p.data?.currencyCode || 'USD') : '—',
    },
    {
      field: 'totalOutstanding',
      headerName: tAccounts('columns.outstandingBalance'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p: { value?: number, data?: { currencyCode?: string } }) => 
        p.value != null ? formatAmount(p.value, p.data?.currencyCode || 'USD') : '—',
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (p: { value?: string | number | Date }) => formatLocalDate(p.value),
    },
    { field: 'deliveryAddressCount', headerName: tCommon('columns.deliveryAddrs'), width: 120, type: 'numericColumn', hide: true },
    { field: 'priceScale', headerName: tCommon('columns.priceScale'), width: 100, type: 'numericColumn', hide: true },
    {
      field: 'accountGroupDiscount',
      headerName: tCommon('columns.groupDisc'),
      width: 110,
      type: 'numericColumn',
      hide: true,
      valueFormatter: (p: { value?: string | number }) => p.value != null ? `${parseFloat(String(p.value)).toFixed(1)}%` : '—',
    },
    {
      field: 'customerDiscount',
      headerName: tCommon('columns.disc'),
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p: { value?: string | number }) => p.value != null ? `${parseFloat(String(p.value)).toFixed(1)}%` : '—',
    },
  ], [tCommon, tAccounts, tStates]);

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
      key: 'customerGroupId',
      label: tCommon('columns.group'),
      type: 'select',
      nullable: true,
      options: customerGroups.map((g) => ({
        label: g.name,
        value: g.customerGroupId,
      })),
      placeholder: 'Select Customer Group...',
    },
    {
      key: 'tradingTermsId',
      label: 'Trading Terms',
      type: 'select',
      nullable: true,
      options: tradingTerms.map((tt) => ({
        label: tt.description || tt.code,
        value: tt.tradingTermsId,
      })),
      placeholder: 'Select Trading Terms...',
      helpText: 'Requires Credit Control permission.',
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
      key: 'priceTier',
      label: tCommon('columns.priceScale'),
      type: 'select',
      nullable: true,
      options: [
        { label: 'Tier 1', value: 'tier_1' },
        { label: 'Tier 2', value: 'tier_2' },
        { label: 'Tier 3', value: 'tier_3' },
        { label: 'Tier 4', value: 'tier_4' },
      ],
      placeholder: 'Select Price Tier...',
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
      key: 'isOnCreditHold',
      label: 'Credit Hold',
      type: 'boolean',
      nullable: false,
      helpText: 'Toggle to place or release credit hold across selected customers.',
    },
    {
      key: 'stateCode',
      label: tCommon('columns.status'),
      type: 'select',
      nullable: false,
      options: [
        { label: tCommon('states.active'), value: CUSTOMER_STATE.ACTIVE },
        { label: tCommon('states.inactive'), value: CUSTOMER_STATE.INACTIVE },
        { label: tCommon('states.archived'), value: CUSTOMER_STATE.ARCHIVED },
      ],
      placeholder: 'Select Status...',
    },
  ], [customerGroups, tradingTerms, taxPositions, tCommon]);

  const handleBulkApply = async (payload: Record<string, unknown>) => {
    const ids = selectedCustomers.map((c) => c.customerId);
    const res = await api.customersControllerBulkUpdate({
      ids,
      ...payload,
    });
    setRefreshTrigger((prev) => prev + 1);
    setSelectedCustomers([]);
    setIsBulkMode(false);
    return res.data;
  };

  return (
    <>
      <DataGrid
        endpoint="/api/customers"
        columns={gridColumns}
        customFieldEntityType="customers"
        gridKey="ops-customers"
        searchPlaceholder={tAccounts('placeholders.searchAccounts')}
        exportFileName="customers"
        showArchivedToggle
        rowIdField="customerId"
        rowSelection={isBulkMode ? 'multiple' : 'single'}
        fetchAll={isBulkMode}
        onSelectionChanged={isBulkMode ? (rows) => setSelectedCustomers(rows as CustomerGridRow[]) : undefined}
        rowHref={isBulkMode ? undefined : (row) => `/customers/${row.customerId}`}
        pageTitle={tAccounts('title')}
        defaultSortModel={[{ colId: 'customerNumber', sort: 'asc' }]}
        refreshTrigger={refreshTrigger}
        headerActions={
          <div className="flex items-center gap-2">
            {canBulkWrite && (
              <Button
                type="button"
                variant={isBulkMode ? 'secondary' : 'ghost'}
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedCustomers([]);
                }}
              >
                {isBulkMode ? tCommon('bulkEdit.exit') : tCommon('bulkEdit.toggle')}
              </Button>
            )}
            <Button asChild variant="primary">
              <Link href="/customers/new">
                {tAccounts('buttons.createCustomer')}
              </Link>
            </Button>
          </div>
        }
        secondaryHeader={
          isBulkMode ? (
            <div className="flex items-center gap-3 py-1">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                {tCommon('bulkEdit.selectedCount', { count: selectedCustomers.length })}
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedCustomers.length === 0}
                onClick={() => setIsBulkOpen(true)}
              >
                {tCommon('bulkEdit.editSelected', { count: selectedCustomers.length })}
              </Button>
            </div>
          ) : undefined
        }
      />

      {isBulkOpen && (
        <BulkEditSlideOver
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          entityName={tAccounts('title')}
          selectedCount={selectedCustomers.length}
          fields={bulkFields}
          onApply={handleBulkApply}
        />
      )}
    </>
  );
}
