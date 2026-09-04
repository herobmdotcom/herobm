'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { getBadgeColor } from '@/lib/utils';
import { CUSTOMER_STATE, SUPPLIER_STATE } from '@herobm/shared';
import type { ActorResponseDto } from '@herobm/sdk';

interface ActorCommercialTabProps {
  actorId: string;
  actor: ActorResponseDto | null;
}

interface SalesOrderRow {
  id: string;
  orderNumber?: string;
  name?: string;
  stateCode?: string;
  totalPrice?: string | number;
  currencyCode?: string;
  createdOn?: string | number | Date;
}

interface PurchaseOrderRow {
  id: string;
  orderNumber?: string;
  stateCode?: string;
  totalPrice?: string | number;
  currencyCode?: string;
  createdOn?: string | number | Date;
}

export function ActorCommercialTab({ actorId, actor }: ActorCommercialTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO typing
  const customer = actor?.customers && (actor.customers as any[])[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO typing
  const supplier = actor?.suppliers && (actor.suppliers as any[])[0];

  const customerStatus = customer?.stateCode || CUSTOMER_STATE.ACTIVE;
  const customerNumber = customer?.customerNumber || '—';
  const creditLimitDisplay = customer?.creditLimit
    ? formatAmount(Number(customer.creditLimit), customer.currencyCode || 'USD')
    : 'Unlimited';
  const creditHoldDisplay = customer?.isOnCreditHold ? 'Yes' : 'No';

  const supplierStatus = supplier?.stateCode || SUPPLIER_STATE.ACTIVE;
  const supplierNumber = supplier?.vendorNumber || '—';
  const purchasingDisplay = supplier?.isPurchasingBlocked ? 'Blocked' : 'Active';
  const supplierCurrency = supplier?.currencyCode || 'USD';

  const salesOrderColumns: Record<string, unknown>[] = useMemo(
    () => [
      {
        field: 'orderNumber',
        headerName: 'Order No.',
        width: 150,
        pinned: 'left' as const,
      },
      {
        field: 'name',
        headerName: 'Title',
        flex: 1,
        minWidth: 160,
      },
      {
        field: 'stateCode',
        headerName: 'Status',
        width: 120,
        valueFormatter: (p: { value?: string }) => p.value || '',
      },
      {
        field: 'totalPrice',
        headerName: 'Total Price',
        width: 130,
        type: 'numericColumn',
        valueGetter: (p: { data?: { totalPrice?: string | number } }) =>
          p.data?.totalPrice ? parseFloat(String(p.data.totalPrice)) : null,
        valueFormatter: (p: { value?: number; data?: { currencyCode?: string } }) =>
          !p.value || p.value === 0
            ? '—'
            : formatAmount(p.value, p.data?.currencyCode || customer?.currencyCode || 'USD'),
      },
      {
        field: 'createdOn',
        headerName: 'Created Date',
        width: 130,
        valueFormatter: (p: { value?: string | number | Date }) =>
          formatLocalDate(p.value),
      },
    ],
    [customer?.currencyCode],
  );

  const purchaseOrderColumns: Record<string, unknown>[] = useMemo(
    () => [
      {
        field: 'orderNumber',
        headerName: 'Order No.',
        width: 150,
        pinned: 'left' as const,
      },
      {
        field: 'stateCode',
        headerName: 'Status',
        width: 120,
      },
      {
        field: 'totalPrice',
        headerName: 'Total Price',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p: { value?: number; data?: { currencyCode?: string } }) =>
          !p.value ? '—' : formatAmount(Number(p.value), p.data?.currencyCode || supplier?.currencyCode || 'USD'),
      },
      {
        field: 'createdOn',
        headerName: 'Created Date',
        width: 130,
        valueFormatter: (p: { value?: string | number | Date }) =>
          formatLocalDate(p.value),
      },
    ],
    [supplier?.currencyCode],
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Customer Account Section */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
              C
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Customer Profile
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Sales accounts, credit terms, and orders linked to this actor
              </p>
            </div>
          </div>
          {customer ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/customers/${customer.customerId}`}>
                View Customer Profile →
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="primary">
              <Link
                href={`/customers/new?actorId=${actorId}&name=${encodeURIComponent(actor?.name || '')}`}
              >
                Register as Customer
              </Link>
            </Button>
          )}
        </div>

        {customer ? (
          <div className="flex flex-col gap-6 mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Customer No.
                </span>
                <span className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                  {customerNumber}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Account Status
                </span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-medium capitalize ${getBadgeColor(customerStatus)}`}
                >
                  {customerStatus}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Credit Limit
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {creditLimitDisplay}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Credit Hold
                </span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-medium ${
                    customer.isOnCreditHold
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}
                >
                  {creditHoldDisplay}
                </span>
              </div>
            </div>

            {/* Embedded Sales Orders */}
            <div className="mt-2">
              <DetailTabGrid<SalesOrderRow>
                title="Sales Orders"
                endpoint={`/api/sales-orders?customerId=${encodeURIComponent(customer.customerId)}&limit=25`}
                columns={salesOrderColumns}
                gridKey={`actor-sales-orders-${customer.customerId}`}
                fetchAll
                rowIdField="id"
                rowHref={(order: { id: string }) => `/sales-orders/${order.id}`}
              />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            This Actor is not currently registered as a Customer. Click above to create a Customer account linked to this actor profile.
          </div>
        )}
      </div>

      {/* Supplier Account Section */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Supplier Profile
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Procurement accounts, payment settings, and purchase orders linked to this actor
              </p>
            </div>
          </div>
          {supplier ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/suppliers/${supplier.vendorId}`}>
                View Supplier Profile →
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="primary">
              <Link
                href={`/suppliers/new?actorId=${actorId}&name=${encodeURIComponent(actor?.name || '')}`}
              >
                Register as Supplier
              </Link>
            </Button>
          )}
        </div>

        {supplier ? (
          <div className="flex flex-col gap-6 mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Vendor No.
                </span>
                <span className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                  {supplierNumber}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Vendor Status
                </span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-medium capitalize ${getBadgeColor(supplierStatus)}`}
                >
                  {supplierStatus}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Purchasing
                </span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-medium ${
                    supplier.isPurchasingBlocked
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}
                >
                  {purchasingDisplay}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] block uppercase font-medium">
                  Currency
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {supplierCurrency}
                </span>
              </div>
            </div>

            {/* Embedded Purchase Orders */}
            <div className="mt-2">
              <DetailTabGrid<PurchaseOrderRow>
                title="Purchase Orders"
                endpoint={`/api/purchase-orders?vendorId=${encodeURIComponent(supplier.vendorId)}&limit=25`}
                columns={purchaseOrderColumns}
                gridKey={`actor-purchase-orders-${supplier.vendorId}`}
                fetchAll
                rowIdField="id"
                rowHref={(po: { id: string }) => `/purchase-orders/${po.id}`}
              />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            This Actor is not currently registered as a Supplier. Click above to create a Supplier account linked to this actor profile.
          </div>
        )}
      </div>
    </div>
  );
}
