'use client';

import React from 'react';
import { OrderLinesTable as SharedOrderLinesTable } from '@/components/shared/OrderLinesTable';
import type { OrderDetail, OrderLine, TaxCategory } from '../types';

interface OrderLinesTableProps {
  order: OrderDetail;
  saving: boolean;
  isOrderLinesEditable: boolean;
  isOrderDetailsEditable: boolean;
  isPostConfirmationAddingEnabled: boolean;
  isPreConfirmation: boolean;
  gapMap: Record<string, import('@herobm/shared').InventoryGap>;
  activeBackorders: Set<string>;
  updateLine: (lineId: string, field: string, value: string | boolean | null | undefined | number) => Promise<void> | void;
  updateLineFields: (lineId: string, fields: Partial<OrderLine>) => Promise<void> | void;
  removeLine: (lineId: string) => void;
  calculateTaxes: () => void;
  taxCategories: TaxCategory[];
  subtotal: number;
  totalTax: number;
}

export function OrderLinesTable({
  order,
  saving,
  isOrderLinesEditable,
  isOrderDetailsEditable,
  isPostConfirmationAddingEnabled,
  isPreConfirmation,
  gapMap,
  activeBackorders,
  updateLine,
  updateLineFields,
  removeLine,
  calculateTaxes,
  taxCategories,
  subtotal,
  totalTax,
}: OrderLinesTableProps) {
  const isStale = order?.customFields?.taxIsStale === true || order?.customFields?.taxIsStale === 'true';

  return (
    <SharedOrderLinesTable<OrderLine>
      lines={order.lines || []}
      currencyCode={order.currencyCode || 'EUR'}
      taxCategories={taxCategories as unknown as import('@/components/shared/OrderLinesTable').TaxCategory[]}
      isEditable={isOrderLinesEditable}
      isSaving={saving}
      isDetailsEditable={isOrderDetailsEditable}
      isPostConfirmationAddingEnabled={isPostConfirmationAddingEnabled}
      isPreConfirmation={isPreConfirmation}
      mode="sales"
      showUnitCost={true}
      gapMap={gapMap}
      activeBackorders={activeBackorders}
      externalTaxProvider={order.taxProvider}
      isTaxStale={isStale}
      subtotal={subtotal}
      totalTax={totalTax}
      onUpdateLine={(lineId, field, val) =>
        updateLine(String(lineId), field, val as string | number | boolean | null | undefined)
      }
      onUpdateLineFields={(lineId, fields) =>
        updateLineFields(String(lineId), fields as Partial<OrderLine>)
      }
      onRemoveLine={(lineId) => removeLine(String(lineId))}
      onCalculateTaxes={calculateTaxes}
    />
  );
}
