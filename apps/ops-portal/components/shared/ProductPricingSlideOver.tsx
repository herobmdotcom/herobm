'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

export interface PricingHistoryEntry {
  salesOrderId: string;
  orderNumber: string;
  orderName?: string | null;
  customerId?: string | null;
  customerName: string;
  isCurrentCustomer: boolean;
  stateCode: string;
  orderDate: string;
  lineNumber: number;
  quantity: string;
  unitOfMeasure?: string | null;
  pricePerUnit: string;
  discountPercentage?: string | null;
  lineTotal?: string | null;
  currencyCode?: string | null;
}

export interface ProductPricingSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  productNumber: string;
  productDescription?: string;
  currentCustomerId?: string | null;
  currentCustomerName?: string;
  currentOrderId?: string | null;
}

export function ProductPricingSlideOver({
  isOpen,
  onClose,
  productId,
  productNumber,
  productDescription,
  currentCustomerId,
  currentCustomerName,
  currentOrderId,
}: ProductPricingSlideOverProps) {
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  const [entries, setEntries] = useState<PricingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [customerOnly, setCustomerOnly] = useState(false);
  const limit = 20;

  const fetchHistory = useCallback(async (p: number, custOnly: boolean) => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await api.ordersControllerGetProductPricingHistory({
        productId,
        customerId: currentCustomerId || undefined,
        excludeOrderId: currentOrderId || undefined,
        page: p,
        limit,
        customerOnly: custOnly || undefined,
      });
      const payload = res.data as unknown as {
        data: PricingHistoryEntry[];
        total: number;
        page: number;
        limit: number;
      };
      setEntries(payload?.data || []);
      setTotal(payload?.total || 0);
    } catch (err) {
      reportError(err, 'ProductPricingSlideOver:fetchHistory');
      toast.error(getErrorMessage(err));
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [productId, currentCustomerId, currentOrderId]);

  useEffect(() => {
    if (isOpen && productId) {
      setPage(1);
      fetchHistory(1, customerOnly);
    } else {
      setEntries([]);
      setTotal(0);
    }
  }, [isOpen, productId, customerOnly, fetchHistory]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchHistory(newPage, customerOnly);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={tSales('pricingSlideOver.title', { product: productNumber || 'Product' })}
      subtitle={
        <div className="flex flex-col gap-0.5">
          {productDescription && (
            <span className="text-xs text-[var(--text-muted)] line-clamp-1">
              {productDescription}
            </span>
          )}
          {currentCustomerName && (
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {tSales('pricingSlideOver.subtitle', { customer: currentCustomerName || tSales('pricing.thisCustomer') })}
            </span>
          )}
        </div>
      }
      width="max-w-4xl"
    >
      <div className="p-4 sm:p-6 space-y-4">
        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
          {currentCustomerId ? (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                checked={customerOnly}
                onChange={(e) => setCustomerOnly(e.target.checked)}
                disabled={!currentCustomerId}
              />
              <span className="font-medium">
                {tSales('pricingSlideOver.customerOnlyToggle')}
              </span>
            </label>
          ) : (
            <div />
          )}

          <div className="text-xs text-[var(--text-muted)]">
            {total > 0 && tSales('pricingSlideOver.pageOf', { page, totalPages })}
          </div>
        </div>

        {/* Table */}
        <DataTable<PricingHistoryEntry>
          data={entries}
          keyExtractor={(entry, idx) => `${entry.salesOrderId}-${entry.lineNumber}-${idx}`}
          emptyMessage={loading ? tCommon('loading') : tSales('pricingSlideOver.emptyMessage')}
          columns={[
            { header: tSales('columns.customer') },
            { header: tSales('columns.orderNumber') },
            { header: tSales('columns.status'), width: 110 },
            { header: tSales('columns.date'), width: 110 },
            { header: tSales('columns.qty'), align: 'right', width: 90 },
            { header: tSales('columns.unitPrice'), align: 'right', width: 110 },
            { header: tSales('columns.discountPct'), align: 'right', width: 80 },
            { header: tSales('columns.totalAmount'), align: 'right', width: 120 },
          ]}
          renderCustomRow={(entry, idx) => {
            return (
              <tr
                key={idx}
                className={entry.isCurrentCustomer ? 'bg-[var(--accent-subtle)]/20' : undefined}
              >
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.isCurrentCustomer && (
                      <span className="badge badge-success text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {tSales('pricing.thisCustomer')}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text-primary)]">
                      {entry.customerName}
                    </span>
                  </div>
                </td>
                <td className="py-2.5">
                  <Link
                    href={routes.salesOrders.detail(entry.salesOrderId)}
                    className="font-semibold text-[var(--accent)] hover:underline"
                  >
                    {entry.orderNumber}
                  </Link>
                </td>
                <td className="py-2.5">
                  <StateBadge state={(entry.stateCode || 'DRAFT') as ValidState} />
                </td>
                <td className="py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {formatLocalDate(entry.orderDate)}
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {entry.quantity} {entry.unitOfMeasure || ''}
                </td>
                <td className="py-2.5 text-right font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {formatAmount(Number(entry.pricePerUnit), entry.currencyCode || 'EUR')}
                </td>
                <td className="py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                  {entry.discountPercentage && Number(entry.discountPercentage) > 0
                    ? `${entry.discountPercentage}%`
                    : '—'}
                </td>
                <td className="py-2.5 text-right font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {entry.lineTotal
                    ? formatAmount(Number(entry.lineTotal), entry.currencyCode || 'EUR')
                    : '—'}
                </td>
              </tr>
            );
          }}
          mobileCard={(entry) => (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.isCurrentCustomer && (
                      <span className="badge badge-success text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {tSales('pricing.thisCustomer')}
                      </span>
                    )}
                    <span className="font-semibold text-sm text-[var(--text-primary)]">
                      {entry.customerName}
                    </span>
                  </div>
                  <Link
                    href={routes.salesOrders.detail(entry.salesOrderId)}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline mt-0.5"
                  >
                    {entry.orderNumber}
                  </Link>
                </div>
                <StateBadge state={(entry.stateCode || 'DRAFT') as ValidState} />
              </div>

              <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-2 text-xs">
                <MobileCardField label={tSales('columns.date')} value={formatLocalDate(entry.orderDate)} />
                <MobileCardField
                  label={tSales('columns.qty')}
                  value={`${entry.quantity} ${entry.unitOfMeasure || ''}`}
                />
                <MobileCardField
                  label={tSales('columns.unitPrice')}
                  value={formatAmount(Number(entry.pricePerUnit), entry.currencyCode || 'EUR')}
                />
                {entry.discountPercentage && Number(entry.discountPercentage) > 0 && (
                  <MobileCardField
                    label={tSales('columns.discountPct')}
                    value={`${entry.discountPercentage}%`}
                  />
                )}
                <MobileCardField
                  label={tSales('columns.totalAmount')}
                  value={entry.lineTotal ? formatAmount(Number(entry.lineTotal), entry.currencyCode || 'EUR') : '—'}
                />
              </div>
            </div>
          )}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
            >
              {tCommon('grid.prev')}
            </Button>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {tSales('pricingSlideOver.pageOf', { page, totalPages })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => handlePageChange(page + 1)}
            >
              {tCommon('grid.next')}
            </Button>
          </div>
        )}
      </div>
    </SlideOver>
  );
}

export default ProductPricingSlideOver;
