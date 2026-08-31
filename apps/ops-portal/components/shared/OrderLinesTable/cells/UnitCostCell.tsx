'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatAmount } from '@/lib/currency';
import { LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface UnitCostCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  currencyCode?: string;
  isEditable: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
}

export function UnitCostCell({
  line,
  lineIdentifier,
  currencyCode = 'EUR',
  isEditable,
  onUpdateLine,
}: UnitCostCellProps) {
  const tCommon = useTranslations('common');

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
          defaultValue={line.unitCost ? parseFloat(String(line.unitCost)).toFixed(2) : ''}
          key={`cost-${lineIdentifier}-${line.unitCost}`}
          placeholder="Auto"
          onBlur={(e) => {
            const val = e.target.value;
            if (!val) {
              if (line.unitCost !== null && line.unitCost !== undefined) {
                onUpdateLine?.(lineIdentifier, 'unitCost', null);
              }
              return;
            }
            const parsed = parseFloat(val);
            const formatted = isNaN(parsed) ? '0.00' : parsed.toFixed(2);
            e.target.value = formatted;
            if (formatted !== (line.unitCost ? parseFloat(String(line.unitCost)).toFixed(2) : null)) {
              onUpdateLine?.(lineIdentifier, 'unitCost', formatted);
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
        value={line.unitCost ?? ''}
        placeholder="Auto"
        onChange={(e) => onUpdateLine?.(lineIdentifier, 'unitCost', e.target.value || null)}
      />
    );
  }

  return (
    <span className="tabular-nums text-[var(--text-muted)] text-xs">
      {line.unitCost
        ? formatAmount(parseFloat(String(line.unitCost)), currencyCode)
        : tCommon('auto')}
    </span>
  );
}
