'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MATCH_STATUS } from '@herobm/shared';

interface POAllocationCellProps {
  data: {
    matchStatus?: string | null;
    purchaseOrderId?: string | null;
    orderNumber?: string | null;
  } | undefined;
}

/**
 * ag-Grid cell renderer for the PO allocation column on the Receiving page.
 * Read-only display: shows the linked PO number or "Unallocated".
 */
export default function POAllocationCell({ data }: POAllocationCellProps) {
  const t = useTranslations('goodsReceived');

  if (!data) return null;

  if (data.matchStatus === MATCH_STATUS.MATCHED) {
    return (
      <div className="flex items-center justify-start h-full w-full">
        <Link 
          href={`/purchase-orders/${data.purchaseOrderId}`}
          className="link font-semibold"
          onClick={(e) => e.stopPropagation()}
        >
          {data.orderNumber}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start w-full h-full">
      <span className="text-[var(--text-muted)] text-xs">{t('matchStatus.unmatched')}</span>
    </div>
  );
}
