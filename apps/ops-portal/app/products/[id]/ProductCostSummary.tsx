'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';

interface ProductCostSummaryProps {
  productId: string;
  product?: api.ProductResponseDto;
}

const formatCurrency = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function ProductCostSummary({ productId, product }: ProductCostSummaryProps) {
  const tProducts = useTranslations('products.costSummary');

  const [summary, setSummary] = useState<api.ProductCostSummaryResponseDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.productsControllerGetCostSummary(productId)
      .then((res) => {
        if (isMounted) {
          setSummary(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          reportError(err, 'ProductCostSummary_fetch');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const weightedAverageCost = summary?.weightedAverageCost ?? (product as unknown as { weightedAverageCost?: string })?.weightedAverageCost ?? null;
  const preferredSupplierCost = summary?.preferredSupplierCost ?? null;
  const lastPurchasePrice = summary?.lastPurchasePrice ?? null;

  return (
    <>
      {/* Weighted Average Cost */}
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {tProducts('weightedAverageCost')}
        </label>
        <div className="input bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-between select-none">
          <span className="tabular-nums font-medium">
            {loading ? '—' : formatCurrency(weightedAverageCost)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {tProducts('weightedAverageCostDesc')}
          </span>
        </div>
      </div>

      {/* Preferred Supplier Cost */}
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {tProducts('preferredSupplier')}
        </label>
        <div className="input bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-between min-w-0">
          <span className="tabular-nums font-medium whitespace-nowrap">
            {loading ? '—' : formatCurrency(preferredSupplierCost)}
          </span>
          <div className="text-xs truncate ml-2 text-right">
            {summary?.preferredSupplierName ? (
              summary.preferredSupplierVendorId ? (
                <Link
                  href={`/suppliers/${summary.preferredSupplierVendorId}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  {summary.preferredSupplierName}
                  {summary.preferredSupplierDiscount && parseFloat(summary.preferredSupplierDiscount) > 0
                    ? ` (-${parseFloat(summary.preferredSupplierDiscount)}%)`
                    : ''}
                </Link>
              ) : (
                <span className="text-[var(--text-secondary)]">
                  {summary.preferredSupplierName}
                  {summary.preferredSupplierDiscount && parseFloat(summary.preferredSupplierDiscount) > 0
                    ? ` (-${parseFloat(summary.preferredSupplierDiscount)}%)`
                    : ''}
                </span>
              )
            ) : (
              <span className="text-[var(--text-muted)] italic">{tProducts('notSet')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Last PO Purchase Price */}
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {tProducts('lastPurchasePrice')}
        </label>
        <div className="input bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-between min-w-0">
          <span className="tabular-nums font-medium whitespace-nowrap">
            {loading ? '—' : formatCurrency(lastPurchasePrice)}
          </span>
          <div className="text-xs truncate ml-2 text-right">
            {summary?.lastPurchaseOrderNumber ? (
              <>
                {summary.lastPurchaseOrderId ? (
                  <Link
                    href={`/purchase-orders/${summary.lastPurchaseOrderId}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {summary.lastPurchaseOrderNumber}
                  </Link>
                ) : (
                  <span className="text-[var(--text-secondary)]">{summary.lastPurchaseOrderNumber}</span>
                )}
                {summary.lastPurchaseDate && (
                  <span className="text-[var(--text-muted)] ml-1">
                    ({formatLocalDate(summary.lastPurchaseDate, undefined, '')})
                  </span>
                )}
              </>
            ) : (
              <span className="text-[var(--text-muted)] italic">{tProducts('notSet')}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductCostSummary;
