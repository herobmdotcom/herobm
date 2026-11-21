'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, MobileCardField, type DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import {
  computeLinePrice,
  computeOrderTotals,
  toFinancialDecimal,
  roundMoney,
  LineType,
} from '@herobm/shared';
import type { OrderLineItem, OrderLinesTableProps, TaxCategory } from './types';
import { ProductCell } from './cells/ProductCell';
import { DescriptionCell } from './cells/DescriptionCell';
import { QuantityCell } from './cells/QuantityCell';
import { UomCell } from './cells/UomCell';
import { PriceCell } from './cells/PriceCell';
import { UnitCostCell } from './cells/UnitCostCell';
import { DiscountCell } from './cells/DiscountCell';
import { TaxCell } from './cells/TaxCell';
import { AmountCell } from './cells/AmountCell';
import { ActionsCell } from './cells/ActionsCell';
import { OrderLinesFooter } from './cells/OrderLinesFooter';

export function OrderLinesTable<T extends OrderLineItem = OrderLineItem>({
  lines,
  currencyCode = 'EUR',
  taxCategories,
  isEditable = true,
  isSaving = false,
  isDetailsEditable = false,
  isPostConfirmationAddingEnabled = false,
  mode = 'sales',
  showUnitCost = false,
  showReceived = false,
  allowCatalogDescriptionEdit = true,
  externalTaxProvider,
  isTaxStale,
  subtotal: passedSubtotal,
  totalTax: passedTotalTax,
  totalDiscount: passedTotalDiscount,
  grandTotal: passedGrandTotal,
  gapMap,
  activeBackorders,
  isPreConfirmation = true,
  customEmptyMessage,
  onUpdateLine,
  onUpdateLineFields,
  onRemoveLine,
  onCalculateTaxes,
  insertAtLineNumber,
  onInsertAbove,
  onReorderLines,
}: OrderLinesTableProps<T>) {
  const tSales = useTranslations('salesOrders');
  const tPurchase = useTranslations('purchaseOrders');
  const tProductSearch = useTranslations('common.productSearch');

  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);

  const getLineIdentifier = (line: T, idx: number): string | number => {
    return line.salesOrderLineId || line.purchaseOrderLineId || line.id || (line.key ?? idx);
  };

  const isLineEditable = (line: T): boolean => {
    return (
      isEditable ||
      (Boolean(line.isPostConfirmation) && isDetailsEditable)
    );
  };

  const hasActionColumn = Boolean(
    onRemoveLine &&
      (isEditable ||
        (lines || []).some((l: T) => l.isPostConfirmation && isDetailsEditable) ||
        isPostConfirmationAddingEnabled)
  );

  // Calculate totals if not explicitly provided
  const { subtotal, totalTax, totalDiscount, grandTotal } = useMemo(() => {
    if (passedSubtotal !== undefined && passedTotalTax !== undefined) {
      return {
        subtotal: passedSubtotal,
        totalTax: passedTotalTax,
        totalDiscount: passedTotalDiscount ?? 0,
        grandTotal: passedGrandTotal ?? (passedSubtotal + passedTotalTax - (passedTotalDiscount ?? 0)),
      };
    }

    let totalDiscountDec = toFinancialDecimal(0);

    const mappedLines = (lines || []).map((line: T) => {
      if (line.lineType === LineType.COMMENT) {
        return { amount: 0, tax: 0 };
      }

      const qtyDec = toFinancialDecimal(line.quantity);
      const priceDec = toFinancialDecimal(line.pricePerUnit);
      const discPct = toFinancialDecimal(line.discountPercentage).toNumber();

      const selectedCat = (taxCategories || []).find((c: TaxCategory) => c.taxCategoryId === line.taxCategoryId);
      const rate = selectedCat
        ? toFinancialDecimal(selectedCat.rate).toNumber()
        : line.taxRate ?? 0;

      const pricing = computeLinePrice({
        quantity: qtyDec.toNumber(),
        pricePerUnit: priceDec.toNumber(),
        discountPercentage: discPct,
        taxRate: rate,
      });

      const lineGross = qtyDec.mul(priceDec);
      const lineDisc = lineGross.minus(pricing.amount);
      totalDiscountDec = totalDiscountDec.plus(lineDisc);

      return {
        amount: pricing.amount,
        tax: pricing.tax,
      };
    });

    const totals = computeOrderTotals(mappedLines);
    return {
      subtotal: totals.subtotal,
      totalDiscount: roundMoney(totalDiscountDec).toNumber(),
      totalTax: totals.totalTax,
      grandTotal: totals.totalAmount,
    };
  }, [lines, taxCategories, passedSubtotal, passedTotalTax, passedTotalDiscount, passedGrandTotal]);

  const columns: DataTableColumn<T>[] = useMemo(() => {
    const showLineControls = Boolean(isEditable && (onInsertAbove || onReorderLines));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic DataTable column definition
    const cols: any[] = [
      {
        id: 'lineNumber',
        header: tSales('columns.lineNumber'),
        width: showLineControls ? 72 : 32,
        render: (line: T, idx: number) => {
          const lineNum = Number(line.lineNumber ?? idx + 1);
          const canControlRow = isEditable && !line.parentLineId;
          return (
            <div className="flex items-center gap-1">
              {canControlRow && onReorderLines && (
                <span
                  className="material-symbols-outlined text-[14px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing select-none"
                  title={tProductSearch('dragToReorder')}
                >
                  drag_indicator
                </span>
              )}
              <span className="text-[var(--text-muted)] font-normal text-xs tabular-nums min-w-[14px]">
                {lineNum}
              </span>
              {canControlRow && onInsertAbove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onInsertAbove(lineNum)}
                  disabled={isSaving}
                  title={tProductSearch('insertLineAbove', { lineNumber: lineNum })}
                  aria-label={tProductSearch('insertLineAbove', { lineNumber: lineNum })}
                  className="opacity-35 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]/30 text-[var(--text-muted)] !rounded !w-4 !h-4 !p-0 !border-0 inline-flex items-center justify-center text-xs font-bold leading-none transition-opacity cursor-pointer disabled:opacity-20"
                >
                  <span aria-hidden="true">{'+'}</span>
                </Button>
              )}
            </div>
          );
        },
      },
      {
        id: 'product',
        header: tSales('columns.product'),
        width: 100,
        render: (line: T) => <ProductCell line={line} />,
      },
      {
        id: 'description',
        header: tSales('columns.description'),
        render: (line: T, idx: number) => (
          <DescriptionCell
            line={line}
            lineIdentifier={getLineIdentifier(line, idx)}
            isEditable={isLineEditable(line)}
            allowCatalogDescriptionEdit={allowCatalogDescriptionEdit}
            onUpdateLine={onUpdateLine}
          />
        ),
      },
      {
        id: 'qty',
        header: tSales('columns.qty'),
        width: 70,
        align: 'right',
        render: (line: T, idx: number) => (
          <QuantityCell
            line={line}
            lineIdentifier={getLineIdentifier(line, idx)}
            isEditable={isLineEditable(line)}
            gapMap={gapMap}
            activeBackorders={activeBackorders}
            isPreConfirmation={isPreConfirmation}
            onUpdateLine={onUpdateLine}
          />
        ),
      },
    ];

    if (showReceived) {
      cols.push({
        id: 'received',
        header: tPurchase('columns.received'),
        width: 65,
        align: 'right',
        render: (line: T) => {
          if (line.lineType === LineType.COMMENT) {
            return <span className="text-xs text-[var(--text-muted)] font-normal">—</span>;
          }
          const recQty = parseFloat(String(line.quantityReceived || '0'));
          return (
            <span
              className={`text-xs tabular-nums ${
                recQty > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'
              }`}
            >
              {recQty}
            </span>
          );
        },
      });
    }

    cols.push({
      id: 'uom',
      header: tSales('columns.uom'),
      width: 50,
      align: 'right',
      render: (line: T, idx: number) => (
        <UomCell
          line={line}
          lineIdentifier={getLineIdentifier(line, idx)}
          isEditable={isLineEditable(line)}
          onUpdateLine={onUpdateLine}
          onUpdateLineFields={onUpdateLineFields}
        />
      ),
    });

    cols.push({
      id: 'unitPrice',
      header: tSales('columns.unitPrice'),
      width: 80,
      align: 'right',
      render: (line: T, idx: number) => (
        <PriceCell
          line={line}
          lineIdentifier={getLineIdentifier(line, idx)}
          currencyCode={currencyCode}
          isEditable={isLineEditable(line)}
          onUpdateLine={onUpdateLine}
        />
      ),
    });

    if (showUnitCost) {
      cols.push({
        id: 'unitCost',
        header: 'Unit Cost',
        width: 80,
        align: 'right',
        render: (line: T, idx: number) => (
          <UnitCostCell
            line={line}
            lineIdentifier={getLineIdentifier(line, idx)}
            currencyCode={currencyCode}
            isEditable={isLineEditable(line)}
            onUpdateLine={onUpdateLine}
          />
        ),
      });
    }

    cols.push({
      id: 'discountPct',
      header: tSales('columns.discountPct'),
      width: 65,
      align: 'right',
      render: (line: T, idx: number) => (
        <DiscountCell
          line={line}
          lineIdentifier={getLineIdentifier(line, idx)}
          isEditable={isLineEditable(line)}
          onUpdateLine={onUpdateLine}
        />
      ),
    });

    cols.push({
      id: 'tax',
      header: (
        <div className="flex items-center justify-end gap-1">
          {tSales('columns.tax')}
          {onCalculateTaxes && isDetailsEditable && (
            <Button
              type="button"
              onClick={onCalculateTaxes}
              disabled={isSaving}
              className={`bg-transparent border-0 p-0 text-[var(--accent)] flex ${
                isSaving ? 'cursor-default' : 'cursor-pointer'
              }`}
              title={tSales('buttons.calculateTaxes')}
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon string */}
              <span className={`material-symbols-outlined text-base ${isSaving ? 'animate-spin' : ''}`}>
                sync
              </span>
            </Button>
          )}
        </div>
      ),
      width: 65,
      align: 'right',
      render: (line: T, idx: number) => (
        <TaxCell
          line={line}
          lineIdentifier={getLineIdentifier(line, idx)}
          taxCategories={taxCategories}
          currencyCode={currencyCode}
          isEditable={isLineEditable(line)}
          externalTaxProvider={externalTaxProvider}
          isTaxStale={isTaxStale}
          onUpdateLine={onUpdateLine}
          onUpdateLineFields={onUpdateLineFields}
        />
      ),
    });

    cols.push({
      id: 'amount',
      header: tSales('columns.amount'),
      width: 105,
      align: 'right',
      className: 'whitespace-nowrap',
      render: (line: T) => (
        <AmountCell
          line={line}
          currencyCode={currencyCode}
          isEditable={isLineEditable(line)}
        />
      ),
    });

    if (hasActionColumn) {
      cols.push({
        id: 'actions',
        header: '',
        width: 36,
        align: 'right',
        render: (line: T, idx: number) => {
          if (!isLineEditable(line)) return null;
          return (
            <ActionsCell
              lineIdentifier={getLineIdentifier(line, idx)}
              onRemoveLine={onRemoveLine}
            />
          );
        },
      });
    }

    return cols;
  }, [
    tSales,
    tPurchase,
    showReceived,
    showUnitCost,
    hasActionColumn,
    currencyCode,
    taxCategories,
    externalTaxProvider,
    isTaxStale,
    isSaving,
    isDetailsEditable,
    allowCatalogDescriptionEdit,
    gapMap,
    activeBackorders,
    isPreConfirmation,
    onCalculateTaxes,
    onRemoveLine,
    onUpdateLine,
    onUpdateLineFields,
    isEditable,
    onInsertAbove,
    onReorderLines,
    tProductSearch,
  ]);

  const handleDropOnRow = (targetLineId: string) => {
    if (!draggedLineId || !onReorderLines || draggedLineId === targetLineId) {
      setDraggedLineId(null);
      setDragOverLineId(null);
      return;
    }

    const topLevelIds = (lines || [])
      .filter((l) => !l.parentLineId)
      .map((l, i) => String(getLineIdentifier(l, i)));

    const fromIdx = topLevelIds.indexOf(draggedLineId);
    const toIdx = topLevelIds.indexOf(targetLineId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDraggedLineId(null);
      setDragOverLineId(null);
      return;
    }

    const reordered = [...topLevelIds];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    setDraggedLineId(null);
    setDragOverLineId(null);
    void onReorderLines(reordered);
  };

  const amountColIndex = columns.findIndex((c) => c.id === 'amount');
  const footerColSpan = amountColIndex !== -1 ? amountColIndex : 8;
  const enableRowInteractivity = Boolean(isEditable && (onReorderLines || onInsertAbove));

  return (
    <DataTable<T>
      data={lines || []}
      keyExtractor={(line: T, idx: number) => String(getLineIdentifier(line, idx))}
      columns={columns}
      emptyMessage={customEmptyMessage || tSales('noLineItems')}
      renderCustomRow={
        enableRowInteractivity
          ? (line, idx, visibleCols) => {
              const rowId = String(getLineIdentifier(line, idx));
              const lineNum = Number(line.lineNumber ?? idx + 1);
              const canDrag = Boolean(isEditable && onReorderLines && !line.parentLineId && !isSaving);
              const isDragging = draggedLineId === rowId;
              const isDragOver = dragOverLineId === rowId && draggedLineId !== rowId;
              const isInsertTarget = insertAtLineNumber === lineNum;

              const draggedIdx = draggedLineId
                ? (lines || []).findIndex((l, i) => String(getLineIdentifier(l, i)) === draggedLineId)
                : -1;
              const dropIndicatorClass = isDragOver
                ? draggedIdx > idx
                  ? 'border-t-2 border-t-[var(--accent)]'
                  : 'border-b-2 border-b-[var(--accent)]'
                : isInsertTarget
                  ? 'border-t-2 border-t-[var(--accent)]'
                  : '';

              return (
                <tr
                  key={rowId}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (!canDrag) return;
                    setDraggedLineId(rowId);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', rowId);
                  }}
                  onDragOver={(e) => {
                    if (!canDrag || !draggedLineId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverLineId !== rowId) {
                      setDragOverLineId(rowId);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverLineId === rowId) {
                      setDragOverLineId(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (!canDrag) return;
                    e.preventDefault();
                    handleDropOnRow(rowId);
                  }}
                  onDragEnd={() => {
                    setDraggedLineId(null);
                    setDragOverLineId(null);
                  }}
                  className={`group ${isDragging ? 'opacity-40' : ''} ${dropIndicatorClass}`}
                >
                  {visibleCols.map((col, j) => {
                    const content = col.render
                      ? col.render(line, idx)
                      : col.accessor
                        ? typeof col.accessor === 'function'
                          ? col.accessor(line)
                          : String(line[col.accessor as keyof T] as unknown)
                        : null;
                    return (
                      <td
                        key={col.id || j}
                        className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            }
          : undefined
      }
      mobileCard={(line: T, idx: number) => {
        const lineId = getLineIdentifier(line, idx);
        const actionCol = hasActionColumn && isLineEditable(line) ? (
          <ActionsCell
            lineIdentifier={lineId}
            onRemoveLine={onRemoveLine}
            isMobile
          />
        ) : null;

        return (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-semibold text-sm text-[var(--accent)]">
                <ProductCell line={line} />
              </div>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded font-medium">
                {line.lineNumber ?? idx + 1}
              </div>
            </div>

            <div className="text-xs text-[var(--text-secondary)] font-medium mb-3 [&_.input]:w-full [&_.input]:!text-xs [&_.input]:h-7 [&_.input]:!py-1">
              <DescriptionCell
                line={line}
                lineIdentifier={lineId}
                isEditable={isLineEditable(line)}
                allowCatalogDescriptionEdit={allowCatalogDescriptionEdit}
                onUpdateLine={onUpdateLine}
              />
            </div>

            <div className="flex flex-col gap-0 border-t border-[var(--border)] pt-1">
              {columns
                .filter((c) =>
                  [
                    'qty',
                    'received',
                    'uom',
                    'unitPrice',
                    'unitCost',
                    'discountPct',
                    'tax',
                    'amount',
                  ].includes(c.id!)
                )
                .map((col) => (
                  <MobileCardField
                    key={col.id}
                    label={col.id === 'tax' ? tSales('columns.tax') : col.header}
                    value={
                      <div
                        className={
                          col.id === 'amount'
                            ? 'font-bold text-[var(--accent)] text-base'
                            : '[&_.input]:!text-xs [&_.input]:h-7 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'
                        }
                      >
                        {col.render?.(line, idx)}
                      </div>
                    }
                  />
                ))}

              {actionCol && <div className="flex justify-end mt-2">{actionCol}</div>}
            </div>
          </div>
        );
      }}
      footer={
        (lines || []).length > 0 ? (
          <OrderLinesFooter
            subtotal={subtotal}
            totalTax={totalTax}
            totalDiscount={totalDiscount}
            grandTotal={grandTotal}
            currencyCode={currencyCode}
            colSpan={footerColSpan}
            hasActionColumn={hasActionColumn}
            externalTaxProvider={externalTaxProvider}
            isTaxStale={isTaxStale}
          />
        ) : null
      }
    />
  );
}
