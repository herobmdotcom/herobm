'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/api';
import ProductPricingSlideOver from '@/components/shared/ProductPricingSlideOver';

interface ProductPricingSummaryProps {
  productId: string;
  productNumber: string;
  productDescription?: string;
  currencyCode?: string;
}

interface PricingHistoryEntry {
  salesOrderId: string;
  orderNumber: string;
  orderName?: string;
  customerId: string;
  customerName: string;
  isCurrentCustomer?: boolean;
  stateCode: string;
  orderDate: string;
  lineNumber: number;
  quantity: string;
  unitOfMeasure: string;
  pricePerUnit: string;
  discountPercentage?: string;
  totalAmount?: string;
  currencyCode?: string;
}

export function ProductPricingSummary({
  productId,
  productNumber,
  productDescription,
  currencyCode,
}: ProductPricingSummaryProps) {
  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products.pricingSummary');

  const [entries, setEntries] = useState<PricingHistoryEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.ordersControllerGetProductPricingHistory({
      productId,
      page: 1,
      limit: 3,
    })
      .then((res) => {
        if (!isMounted) return;
        const payload = res.data as unknown as {
          data: PricingHistoryEntry[];
          total: number;
        };
        setEntries(payload?.data || []);
        setTotal(payload?.total || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        reportError(err, 'ProductPricingSummary:fetch');
        setEntries([]);
        setTotal(0);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {tProducts('title')}
        </h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="!text-xs h-7 !py-1 !px-2"
          onClick={() => setIsSlideOverOpen(true)}
          title={tProducts('viewAll')}
        >
          {loading
            ? tProducts('viewAll')
            : tProducts('viewAllWithCount', { count: total })}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-[var(--text-muted)] py-2">
          {tCommon('loading')}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] italic py-1">
          {tProducts('noHistory')}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry, idx) => (
            <div
              key={`${entry.salesOrderId}-${idx}`}
              className="flex items-center gap-2 text-xs flex-wrap px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50"
            >
              <span className="font-medium text-[var(--text-secondary)]">
                {entry.customerName}:
              </span>

              <span className="font-mono font-semibold text-[var(--text-primary)]">
                {formatAmount(Number(entry.pricePerUnit), entry.currencyCode || currencyCode || 'EUR')} @ {entry.quantity} {entry.unitOfMeasure || ''}
              </span>

              {entry.discountPercentage && Number(entry.discountPercentage) > 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  (-{entry.discountPercentage}%)
                </span>
              )}

              <Link
                href={routes.salesOrders.detail(entry.salesOrderId)}
                className="font-medium text-[var(--accent)] hover:underline ml-1"
              >
                {entry.orderNumber}
              </Link>

              <span className="text-[11px] text-[var(--text-muted)]">
                {formatLocalDate(entry.orderDate)}
              </span>

              <div className="ml-auto">
                <StateBadge state={(entry.stateCode || 'DRAFT') as ValidState} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isSlideOverOpen && (
        <ProductPricingSlideOver
          isOpen={isSlideOverOpen}
          onClose={() => setIsSlideOverOpen(false)}
          productId={productId}
          productNumber={productNumber}
          productDescription={productDescription}
        />
      )}
    </div>
  );
}

export default ProductPricingSummary;
