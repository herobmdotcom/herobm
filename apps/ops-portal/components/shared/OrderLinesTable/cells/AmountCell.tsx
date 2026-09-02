'use client';

import React from 'react';
import { formatAmount } from '@/lib/currency';
import { computeLinePrice, LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface AmountCellProps {
  line: OrderLineItem;
  currencyCode?: string;
  isEditable?: boolean;
}

export function AmountCell({
  line,
  currencyCode = 'EUR',
  isEditable,
}: AmountCellProps) {
  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  let lineAmount = 0;
  if (line.amount !== undefined && line.amount !== null && line.amount !== '') {
    lineAmount = parseFloat(String(line.amount));
  } else {
    lineAmount = computeLinePrice({
      quantity: parseFloat(String(line.quantity || '0')),
      pricePerUnit: parseFloat(String(line.pricePerUnit || '0')),
      discountPercentage: parseFloat(String(line.discountPercentage || '0')),
    }).amount;
  }

  return (
    <span
      className={`font-semibold tabular-nums text-xs ${
        isEditable ? 'text-[var(--text-primary)]' : ''
      }`}
    >
      {formatAmount(lineAmount, currencyCode)}
    </span>
  );
}
