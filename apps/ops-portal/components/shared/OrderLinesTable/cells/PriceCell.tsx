'use client';

import React from 'react';
import { formatAmount } from '@/lib/currency';
import { LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface PriceCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  currencyCode?: string;
  isEditable: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
}

export function PriceCell({
  line,
  lineIdentifier,
  currencyCode = 'EUR',
  isEditable,
  onUpdateLine,
}: PriceCellProps) {
  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  const isPersisted = Boolean(line.salesOrderLineId || line.purchaseOrderLineId);

  if (isEditable) {
    if (isPersisted) {
      return (
        <input
          className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
          type="number"
          min="0"
          step="0.01"
          defaultValue={parseFloat(String(line.pricePerUnit || '0')).toFixed(2)}
          key={`price-${lineIdentifier}-${line.pricePerUnit}`}
          onBlur={(e) => {
            const val = parseFloat(e.target.value);
            const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
            e.target.value = formatted;
            if (formatted !== parseFloat(String(line.pricePerUnit || '0')).toFixed(2)) {
              onUpdateLine?.(lineIdentifier, 'pricePerUnit', formatted);
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
        step="0.01"
        value={line.pricePerUnit ?? ''}
        onChange={(e) => onUpdateLine?.(lineIdentifier, 'pricePerUnit', e.target.value)}
        onBlur={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            onUpdateLine?.(lineIdentifier, 'pricePerUnit', val.toFixed(2));
          }
        }}
      />
    );
  }

  return (
    <span className="tabular-nums text-xs">
      {formatAmount(parseFloat(String(line.pricePerUnit || '0')), currencyCode)}
    </span>
  );
}
