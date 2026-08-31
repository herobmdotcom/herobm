'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface QuantityCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  isEditable: boolean;
  gapMap?: Record<string, import('@herobm/shared').InventoryGap>;
  activeBackorders?: Set<string>;
  isPreConfirmation?: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
}

export function QuantityCell({
  line,
  lineIdentifier,
  isEditable,
  gapMap,
  activeBackorders,
  isPreConfirmation,
  onUpdateLine,
}: QuantityCellProps) {
  const tSales = useTranslations('salesOrders');

  if (line.lineType === LineType.COMMENT) {
    return <span className="text-[var(--text-muted)] text-xs">—</span>;
  }

  const lineId = String(line.salesOrderLineId || line.id || lineIdentifier);
  const isCustom =
    !line.productId ||
    line.productId === CUSTOM_LINE_ID ||
    line.productId === '00000000-0000-0000-0000-000000000000' ||
    line.productNumber === 'SYSTEM-CUSTOM-LINE';

  const hasGap = Boolean(
    isPreConfirmation && gapMap && gapMap[lineId] !== undefined
  );
  const isBackordered = Boolean(
    !isPreConfirmation &&
      line.productId &&
      activeBackorders?.has(line.productId)
  );

  const qtyVal = parseFloat(String(line.quantity || '0'));
  const onHandVal =
    line.onHand ??
    (gapMap?.[lineId]?.availableQuantity !== undefined
      ? parseFloat(String(gapMap[lineId].availableQuantity))
      : undefined);
  const hasShortageDirect =
    !isCustom &&
    onHandVal !== undefined &&
    qtyVal > onHandVal;

  const hasWarning = hasGap || isBackordered || hasShortageDirect;
  const isRose = hasGap || hasShortageDirect;

  const warningTitle = hasGap
    ? tSales('availabilityStatus.shortage')
    : isBackordered
    ? tSales('availabilityStatus.backordered')
    : hasShortageDirect
    ? `${tSales('availabilityStatus.shortage')} (${onHandVal} available)`
    : '';

  const warningIconStr = isRose ? 'warning' : 'schedule';

  const warningIcon = hasWarning ? (
    <span
      className={`material-symbols-outlined text-[13px] font-normal opacity-75 ${
        isEditable
          ? 'absolute -left-3.5 top-1/2 -translate-y-1/2 z-[1]'
          : 'relative align-middle mr-1'
      } ${isRose ? 'text-rose-500' : 'text-amber-500'}`}
      title={warningTitle}
    >
      {warningIconStr}
    </span>
  ) : null;

  const isPersisted = Boolean(line.salesOrderLineId || line.purchaseOrderLineId);

  if (isEditable) {
    return (
      <div className="relative">
        {warningIcon}
        {isPersisted ? (
          <input
            className={`input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1 ${
              hasWarning ? (isRose ? 'border-rose-300' : 'border-amber-300') : ''
            }`}
            type="number"
            min="0"
            step="any"
            defaultValue={parseFloat(String(line.quantity || '0'))}
            key={`qty-${lineIdentifier}-${line.quantity}`}
            onBlur={(e) => {
              if (e.target.value !== String(line.quantity)) {
                onUpdateLine?.(lineIdentifier, 'quantity', e.target.value);
              }
            }}
          />
        ) : (
          <input
            className={`input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1 ${
              hasWarning ? (isRose ? 'border-rose-300' : 'border-amber-300') : ''
            }`}
            type="number"
            min="0"
            step="any"
            value={line.quantity ?? ''}
            onChange={(e) => onUpdateLine?.(lineIdentifier, 'quantity', e.target.value)}
          />
        )}
      </div>
    );
  }

  return (
    <span
      className={`tabular-nums text-xs ${
        hasGap || hasShortageDirect ? 'text-rose-600 font-medium' : ''
      }`}
    >
      {warningIcon}
      {parseFloat(String(line.quantity || '0'))}
    </span>
  );
}
