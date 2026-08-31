'use client';

import React from 'react';
import { LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface DiscountCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  isEditable: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
}

export function DiscountCell({
  line,
  lineIdentifier,
  isEditable,
  onUpdateLine,
}: DiscountCellProps) {
  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  const discVal = parseFloat(String(line.discountPercentage || '0'));
  const formattedDisc = isNaN(discVal) ? '0' : String(discVal);
  const isPersisted = Boolean(line.salesOrderLineId || line.purchaseOrderLineId);

  if (isEditable) {
    if (isPersisted) {
      return (
        <input
          className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
          type="number"
          min="0"
          max="100"
          step="any"
          defaultValue={formattedDisc}
          key={`disc-${lineIdentifier}-${line.discountPercentage}`}
          onBlur={(e) => {
            const val = parseFloat(e.target.value);
            const clampedVal = isNaN(val) ? 0 : Math.min(Math.max(val, 0), 100);
            const nextVal = String(clampedVal);
            e.target.value = nextVal;
            if (nextVal !== formattedDisc) {
              onUpdateLine?.(lineIdentifier, 'discountPercentage', nextVal);
            }
          }}
        />
      );
    }

    return (
      <input
        className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={line.discountPercentage ?? ''}
        onChange={(e) => {
          let sanitizedValue = e.target.value;
          const num = parseFloat(sanitizedValue);
          if (!isNaN(num)) {
            if (num < 0) sanitizedValue = '0';
            else if (num > 100) sanitizedValue = '100';
          }
          onUpdateLine?.(lineIdentifier, 'discountPercentage', sanitizedValue);
        }}
      />
    );
  }

  return <span className="tabular-nums text-xs">{formattedDisc}%</span>;
}
