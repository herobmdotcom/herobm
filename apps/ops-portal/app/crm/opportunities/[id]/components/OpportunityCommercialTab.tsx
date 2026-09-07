'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { ColDef } from 'ag-grid-community';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { useSettings } from '@/components/SettingsProvider';

interface OpportunityCommercialTabProps {
  opportunityId: string;
  opportunityName?: string;
  currencyCode?: string | null;
  dealRevenue?: number | null;
  quoteCount?: number | null;
}

interface SalesOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  customerName: string;
  stateCode: string;
  totalPrice: string | null;
  currencyCode: string | null;
  createdOn: string | null;
}

import { SALES_ORDER_STATE } from '@herobm/shared';

function getStatusBadgeClass(status: string) {
  const s = status.toLowerCase();
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

export default function OpportunityCommercialTab({
  opportunityId,
  currencyCode,
  dealRevenue = 0,
  quoteCount = 0,
}: OpportunityCommercialTabProps) {
  const { baseCurrency } = useSettings();
  const activeCurrency = currencyCode || baseCurrency;

  const formattedRevenue = useMemo(() => {
    const num = Number(dealRevenue || 0);
    if (!activeCurrency) {
      return num.toLocaleString();
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
    }).format(num);
  }, [dealRevenue, activeCurrency]);

  const columns = useMemo<ColDef<SalesOrderRow>[]>(
    () => [
      {
        field: 'orderNumber',
        headerName: 'Quote / Order #',
        width: 150,
        pinned: 'left',
        cellRenderer: (p: { value: string; data?: SalesOrderRow }) => {
          if (!p.data) return p.value;
          return (
            <Link
              href={`/sales-orders/${p.data.id}`}
              className="text-[var(--accent)] hover:underline font-mono font-medium"
            >
              {p.value}
            </Link>
          );
        },
      },
      {
        field: 'name',
        headerName: 'Title / Description',
        minWidth: 180,
        flex: 1.5,
      },
      {
        field: 'customerName',
        headerName: 'Customer',
        minWidth: 160,
        flex: 1.2,
      },
      {
        field: 'stateCode',
        headerName: 'Status',
        width: 120,
        cellRenderer: (p: { value: string }) => {
          if (!p.value) return '—';
          return (
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${getStatusBadgeClass(
                p.value,
              )}`}
            >
              {p.value}
            </span>
          );
        },
      },
      {
        field: 'totalPrice',
        headerName: 'Live Total',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p: { value?: string | null; data?: SalesOrderRow }) => {
          if (!p.value && p.value !== '0') return '—';
          const rowCurr = p.data?.currencyCode || activeCurrency;
          const num = Number(p.value);
          if (!rowCurr) return num.toLocaleString();
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: rowCurr,
            minimumFractionDigits: 2,
          }).format(num);
        },
      },
      {
        field: 'createdOn',
        headerName: 'Created',
        width: 130,
        valueFormatter: (p: { value?: string | null }) =>
          p.value ? formatLocalDate(p.value) : '—',
      },
    ],
    [activeCurrency],
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Simple Commercial Stat Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-[var(--text-muted)] block uppercase font-medium tracking-wider">
              Deal Revenue
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1 block">
              {formattedRevenue}
            </span>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              Live aggregation of quote line items
            </span>
          </div>

          <div>
            <span className="text-xs text-[var(--text-muted)] block uppercase font-medium tracking-wider">
              Quotes & Orders
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1 block">
              {quoteCount}
            </span>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              Associated active quotes & orders
            </span>
          </div>
        </div>
      </div>

      {/* Embedded Sales Quotes Grid */}
      <DetailTabGrid<SalesOrderRow>
        title="Sales Quotes & Orders"
        endpoint={`/api/sales-orders?opportunityId=${encodeURIComponent(opportunityId)}&limit=50`}
        columns={columns}
        gridKey={`opportunity-quotes-${opportunityId}`}
        fetchAll
        rowIdField="id"
        rowHref={(order: { id: string }) => `/sales-orders/${order.id}`}
        headerActions={
          <Button asChild variant="primary" size="sm">
            <Link href={`/sales-orders/new?opportunityId=${encodeURIComponent(opportunityId)}`}>
              Create Quote
            </Link>
          </Button>
        }
      />
    </div>
  );
}
