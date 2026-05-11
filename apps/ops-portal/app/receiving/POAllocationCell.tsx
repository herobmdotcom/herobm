'use client';

import React from 'react';

import Link from 'next/link';
import { MATCH_STATUS } from '@modbm/shared';

interface POAllocationCellProps {
  data: any;
}

/**
 * ag-Grid cell renderer for the PO allocation column on the Receiving page.
 * Read-only display: shows the linked PO number or "Unallocated".
 */
export default function POAllocationCell({ data }: POAllocationCellProps) {
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
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="text-[var(--text-muted)] text-xs">Unmatched</span>
    </div>
  );
}
