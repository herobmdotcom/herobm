'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

export function ProductCell({ line }: { line: OrderLineItem }) {
  const tSales = useTranslations('salesOrders');

  const isComment = line.lineType === LineType.COMMENT;
  if (isComment) {
    return (
      <span className="font-semibold text-xs flex items-center">
        <span className="text-[var(--text-muted)] font-medium text-xs">
          COMMENT
        </span>
        {line.isPostConfirmation && (
          <span className="ml-2 badge badge-sm badge-accent">
            {tSales('columns.postConfirmation')}
          </span>
        )}
      </span>
    );
  }

  const isCustom =
    !line.productId ||
    line.productId === CUSTOM_LINE_ID ||
    line.productId === '00000000-0000-0000-0000-000000000000' ||
    line.productNumber === 'SYSTEM-CUSTOM-LINE';

  return (
    <span className="font-semibold text-xs flex items-center font-mono">
      {!isCustom && line.productId ? (
        <Link
          href={`/products/${line.productId}`}
          className="text-[var(--accent)] no-underline hover:underline font-mono"
        >
          {line.productNumber || line.productId?.substring(0, 8)}
        </Link>
      ) : (
        <span className="text-[var(--text-muted)] font-medium text-xs font-sans">
          CUSTOM
        </span>
      )}
      {line.isPostConfirmation && (
        <span className="ml-2 badge badge-sm badge-accent font-sans">
          {tSales('columns.postConfirmation')}
        </span>
      )}
    </span>
  );
}
