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

  const moqVal =
    line.minPurchaseQty !== undefined && line.minPurchaseQty !== null && line.minPurchaseQty !== ''
      ? parseFloat(String(line.minPurchaseQty))
      : undefined;
  const unitMultiple =
    line.purchaseUnit !== undefined &&
    line.purchaseUnit !== null &&
    line.purchaseUnit !== '' &&
    !isNaN(Number(line.purchaseUnit))
      ? parseFloat(String(line.purchaseUnit))
      : undefined;

  const hasMoq = Boolean(moqVal !== undefined && !isNaN(moqVal) && moqVal > 1);
  const isBelowMoq = Boolean(
    hasMoq && (qtyVal <= 0 || qtyVal < (moqVal || 0)),
  );
  const isNotMultiple = Boolean(
    unitMultiple !== undefined &&
    unitMultiple > 1 &&
    (qtyVal <= 0 || (qtyVal % unitMultiple !== 0)),
  );
  const isSupplierQtyWarning = isBelowMoq || isNotMultiple;

  const hasInventoryWarning = hasGap || isBackordered || hasShortageDirect;
  const hasWarning = hasInventoryWarning || isSupplierQtyWarning;
  const isRose = hasGap || hasShortageDirect;

  const warningTitle = hasGap
    ? tSales('availabilityStatus.shortage')
    : isBackordered
    ? tSales('availabilityStatus.backordered')
    : hasShortageDirect
    ? `${tSales('availabilityStatus.shortage')} (${onHandVal} available)`
    : '';

  const warningIconStr = isRose ? 'warning' : 'schedule';

  const warningIcon = hasInventoryWarning ? (
    <span
      className={`material-symbols-outlined text-[14px] font-normal shrink-0 mr-1 select-none cursor-help ${
        isRose ? 'text-rose-500' : 'text-amber-500'
      }`}
      title={warningTitle}
    >
      {warningIconStr}
    </span>
  ) : null;

  const isPersisted = Boolean(line.salesOrderLineId || line.purchaseOrderLineId);

  if (isEditable) {
    return (
      <div className="flex flex-col items-end justify-center w-full">
        <div className="relative flex items-center justify-end w-full">
          {warningIcon}
          {isPersisted ? (
            <input
              className={`input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1 ${
                hasWarning
                  ? isRose
                    ? 'border-rose-400 bg-rose-50/20 text-rose-700 dark:text-rose-400'
                    : 'border-amber-400 bg-amber-50/20 text-amber-700 dark:text-amber-400'
                  : ''
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
                hasWarning
                  ? isRose
                    ? 'border-rose-400 bg-rose-50/20 text-rose-700 dark:text-rose-400'
                    : 'border-amber-400 bg-amber-50/20 text-amber-700 dark:text-amber-400'
                  : ''
              }`}
              type="number"
              min="0"
              step="any"
              value={line.quantity ?? ''}
              onChange={(e) => onUpdateLine?.(lineIdentifier, 'quantity', e.target.value)}
            />
          )}
        </div>
        {hasMoq || line.purchaseUnit ? (
          <div className="flex items-center gap-1 text-[10px] font-mono leading-tight mt-0.5 whitespace-nowrap">
            {hasMoq && (
              <span
                className={
                  isBelowMoq
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-[var(--text-muted)]'
                }
              >
                MOQ: {moqVal}
              </span>
            )}
            {hasMoq && line.purchaseUnit && (
              <span className="text-[var(--text-muted)]">•</span>
            )}
            {line.purchaseUnit && (
              <span
                className={
                  isNotMultiple
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-[var(--text-muted)]'
                }
              >
                Unit: {line.purchaseUnit}
              </span>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end justify-center">
      <span
        className={`tabular-nums text-xs inline-flex items-center justify-end ${
          hasGap || hasShortageDirect ? 'text-rose-600 font-medium' : isSupplierQtyWarning ? 'text-amber-600 font-medium' : ''
        }`}
      >
        {warningIcon}
        {parseFloat(String(line.quantity || '0'))}
      </span>
      {hasMoq || line.purchaseUnit ? (
        <div className="flex items-center gap-1 text-[10px] font-mono leading-tight mt-0.5 whitespace-nowrap">
          {hasMoq && (
            <span
              className={
                isBelowMoq
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-[var(--text-muted)]'
              }
            >
              MOQ: {moqVal}
            </span>
          )}
          {hasMoq && line.purchaseUnit && (
            <span className="text-[var(--text-muted)]">•</span>
          )}
          {line.purchaseUnit && (
            <span
              className={
                isNotMultiple
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-[var(--text-muted)]'
              }
            >
              Unit: {line.purchaseUnit}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
