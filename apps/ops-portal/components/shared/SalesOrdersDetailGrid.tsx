'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ColDef } from 'ag-grid-community';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import { SALES_ORDER_STATE } from '@herobm/shared';

export interface SalesOrdersDetailGridProps {
  customerId?: string;
  opportunityId?: string;
  productId?: string;
  title?: string;
  showCustomerColumn?: boolean;
  showProductQuantities?: boolean;
  currencyCode?: string;
  createButtonLabel?: string;
  headerActions?: React.ReactNode;
  hideHeaderActions?: boolean;
  limit?: number;
  gridKey?: string;
  exportFileName?: string;
}

export interface SalesOrderGridRow {
  id: string;
  orderNumber?: string;
  name?: string;
  customerName?: string;
  customerOrderNumber?: string;
  customer?: {
    customerId?: string;
    customerNumber?: string;
    name?: string;
    organization?: {
      name?: string;
    };
  } | null;
  stateCode?: string;
  totalPrice?: string | number | null;
  currencyCode?: string | null;
  productQuantity?: string | number | null;
  productQuantityShipped?: string | number | null;
  createdOn?: string | number | Date | null;
}

function getSalesOrderStatusBadgeClass(status: string) {
  const s = (status || '').toLowerCase();
  if (s === SALES_ORDER_STATE.DRAFT || s === SALES_ORDER_STATE.QUOTED) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
  if (
    s === SALES_ORDER_STATE.CONFIRMED ||
    s === SALES_ORDER_STATE.PICKING ||
    s === SALES_ORDER_STATE.SHIPPED ||
    s === SALES_ORDER_STATE.INVOICED
  ) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (s === SALES_ORDER_STATE.CANCELLED) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
  }
  return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
}

export function SalesOrdersDetailGrid({
  customerId,
  opportunityId,
  productId,
  title,
  showCustomerColumn,
  showProductQuantities,
  currencyCode,
  createButtonLabel,
  headerActions,
  hideHeaderActions = false,
  limit = 50,
  gridKey,
  exportFileName,
}: SalesOrdersDetailGridProps) {
  const tSales = useTranslations('salesOrders');
  const tStates = useTranslations('common.states');
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (opportunityId) params.set('opportunityId', opportunityId);
    if (productId) params.set('productId', productId);
    params.set('limit', String(limit));
    return `/api/sales-orders?${params.toString()}`;
  }, [customerId, opportunityId, productId, limit]);

  const shouldShowCustomer =
    showCustomerColumn !== undefined ? showCustomerColumn : !customerId;
  const isProductMode =
    showProductQuantities !== undefined ? showProductQuantities : Boolean(productId);

  const columns = useMemo<ColDef<SalesOrderGridRow>[]>(() => {
    const cols: ColDef<SalesOrderGridRow>[] = [
      {
        field: 'orderNumber',
        headerName: tCommon('columns.orderNumber'),
        width: 150,
        pinned: 'left',
        cellRenderer: (p: { value?: string; data?: SalesOrderGridRow }) => {
          if (!p.value) return '—';
          return (
            <Link
              href={`/sales-orders/${p.data?.id}`}
              className="font-semibold text-[var(--accent)] hover:underline font-mono"
            >
              {p.value}
            </Link>
          );
        },
      },
      {
        field: 'name',
        headerName: tCommon('columns.name'),
        minWidth: 160,
        flex: 1.2,
      },
    ];

    if (shouldShowCustomer) {
      cols.push({
        headerName: tSales('columns.customer') || tCommon('columns.customer'),
        minWidth: 160,
        flex: 1.1,
        valueGetter: (p: { data?: SalesOrderGridRow }) =>
          p.data?.customerName ||
          p.data?.customer?.organization?.name ||
          p.data?.customer?.name ||
          p.data?.customer?.customerNumber ||
          '—',
      });
    }

    if (isProductMode) {
      cols.push(
        {
          field: 'productQuantity',
          headerName: tSales('columns.orderedQty'),
          type: 'numericColumn',
          width: 120,
          valueFormatter: (p: { value?: string | number | null }) =>
            p.value ? parseFloat(String(p.value)).toLocaleString() : '—',
        },
        {
          field: 'productQuantityShipped',
          headerName: tSales('columns.shippedQty'),
          type: 'numericColumn',
          width: 120,
          valueFormatter: (p: { value?: string | number | null }) =>
            p.value ? parseFloat(String(p.value)).toLocaleString() : '—',
        },
      );
    }

    cols.push({
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 120,
      cellRenderer: (p: { value?: string }) => {
        if (!p.value) return '—';
        const s = String(p.value).toLowerCase();
        const badgeClass = getSalesOrderStatusBadgeClass(s);
        const label = tStates.has(s as Parameters<typeof tStates>[0])
          ? tStates(s as Parameters<typeof tStates>[0])
          : String(p.value).toUpperCase();
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeClass}`}
          >
            {label}
          </span>
        );
      },
    });

    if (!isProductMode) {
      cols.push({
        field: 'customerOrderNumber',
        headerName: tCommon('columns.customerPO'),
        width: 140,
        valueFormatter: (p: { value?: string | null }) => p.value || '—',
      });
    }

    cols.push(
      {
        field: 'totalPrice',
        headerName: tCommon('columns.totalPrice'),
        width: 130,
        type: 'numericColumn',
        valueGetter: (p: { data?: SalesOrderGridRow }) =>
          p.data?.totalPrice !== undefined && p.data?.totalPrice !== null
            ? parseFloat(String(p.data.totalPrice))
            : null,
        valueFormatter: (p: { value?: number | null; data?: SalesOrderGridRow }) => {
          if (p.value === null || p.value === undefined || isNaN(p.value)) return '—';
          const rowCurr = p.data?.currencyCode || currencyCode || baseCurrency || 'USD';
          return formatAmount(p.value, rowCurr);
        },
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 120,
        valueFormatter: (p: { value?: string | number | Date | null }) =>
          p.value ? formatLocalDate(p.value) : '—',
      },
    );

    return cols;
  }, [tCommon, tSales, tStates, shouldShowCustomer, isProductMode, currencyCode, baseCurrency]);

  const defaultHeaderActions = useMemo(() => {
    if (hideHeaderActions || isProductMode) return undefined;
    if (headerActions) return headerActions;

    const queryParams: string[] = [];
    if (opportunityId) queryParams.push(`opportunityId=${encodeURIComponent(opportunityId)}`);
    if (customerId) queryParams.push(`customerId=${encodeURIComponent(customerId)}`);
    const qs = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const label =
      createButtonLabel ||
      (opportunityId
        ? tSales.has('buttons.createQuote')
          ? tSales('buttons.createQuote')
          : 'Create Quote'
        : tSales.has('buttons.createOrder')
        ? tSales('buttons.createOrder')
        : 'Create Order');

    return (
      <Button asChild size="sm" variant="primary">
        <Link href={`/sales-orders/new${qs}`}>{label}</Link>
      </Button>
    );
  }, [hideHeaderActions, isProductMode, headerActions, opportunityId, customerId, createButtonLabel, tSales]);

  const defaultKey =
    gridKey || `sales-orders-detail-grid-${customerId || ''}-${opportunityId || ''}-${productId || ''}`;
  const defaultTitle = title || tSales('sales');

  return (
    <DetailTabGrid<SalesOrderGridRow>
      title={defaultTitle}
      endpoint={endpoint}
      columns={columns}
      gridKey={defaultKey}
      urlPrefix="sales-orders"
      searchPlaceholder={tSales('placeholders.searchOrders')}
      exportFileName={exportFileName || 'sales-orders'}
      fetchAll
      rowIdField="id"
      rowHref={(order: { id: string }) => `/sales-orders/${order.id}`}
      headerActions={defaultHeaderActions}
    />
  );
}

export default SalesOrdersDetailGrid;
