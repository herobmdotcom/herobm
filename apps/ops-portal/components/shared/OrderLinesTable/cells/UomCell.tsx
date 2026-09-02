'use client';

import React from 'react';
import { calculateUomPriceAdjustment, LineType } from '@herobm/shared';
import type { ProductUom } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface UomCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  isEditable: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
  onUpdateLineFields?: (indexOrId: string | number, fields: Record<string, unknown>) => void | Promise<void>;
}

export function UomCell({
  line,
  lineIdentifier,
  isEditable,
  onUpdateLine,
  onUpdateLineFields,
}: UomCellProps) {
  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  const defaultUom = line.baseUom || 'EA';
  const currentUom = line.unitOfMeasure || defaultUom;

  if (!isEditable) {
    return <span className="tabular-nums text-xs">{currentUom}</span>;
  }

  const selectOptions: Array<{ uomCode: string; ratio?: string | number }> =
    (line.productUoms || []).length > 0
      ? (line.productUoms as Array<{ uomCode: string; ratio?: string | number }>)
      : [{ uomCode: defaultUom, ratio: 1 }];

  const handleUomChange = (newVal: string) => {
    const oldVal = currentUom;
    if (newVal === oldVal) return;

    const oldO = selectOptions.find((o) => o.uomCode === oldVal);
    const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
    const newO = selectOptions.find((o) => o.uomCode === newVal);
    const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);

    const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
    const formattedPrice = isNaN(newPrice) ? '0.00' : newPrice.toFixed(2);

    if (onUpdateLineFields) {
      onUpdateLineFields(lineIdentifier, {
        unitOfMeasure: newVal,
        pricePerUnit: formattedPrice,
      });
    } else {
      onUpdateLine?.(lineIdentifier, 'unitOfMeasure', newVal);
      onUpdateLine?.(lineIdentifier, 'pricePerUnit', formattedPrice);
    }
  };

  return (
    <div className="relative w-full">
      <div className="input w-full !text-xs text-center h-7 !px-1 py-1 flex items-center justify-center pointer-events-none">
        <span className="tabular-nums">{currentUom}</span>
      </div>
      <select
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        value={currentUom}
        onChange={(e) => handleUomChange(e.target.value)}
      >
        {selectOptions.map((o) => (
          <option key={o.uomCode} value={o.uomCode}>
            {o.uomCode}
          </option>
        ))}
      </select>
    </div>
  );
}
