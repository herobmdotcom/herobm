'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, MobileCardField, type DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import { computeLinePrice, computeOrderTotals, LineType } from '@herobm/shared';
import type { OrderLineItem, OrderLinesTableProps } from './types';
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
}: OrderLinesTableProps<T>) {
  const tSales = useTranslations('salesOrders');
  const tPurchase = useTranslations('purchaseOrders');

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
        (lines || []).some((l) => l.isPostConfirmation && isDetailsEditable) ||
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

    let sub = 0;
    let disc = 0;
    let tax = 0;

    const mappedLines = (lines || []).map((line) => {
      if (line.lineType === LineType.COMMENT) {
        return { amount: 0, tax: 0 };
      }

      const qty = parseFloat(String(line.quantity || '0'));
      const price = parseFloat(String(line.pricePerUnit || '0'));
      const discPct = parseFloat(String(line.discountPercentage || '0'));

      const selectedCat = taxCategories.find((c) => c.taxCategoryId === line.taxCategoryId);
      const rate = selectedCat
        ? parseFloat(String(selectedCat.rate || '0'))
        : line.taxRate ?? 0;

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: price,
        discountPercentage: discPct,
        taxRate: rate,
      });

      const lineGross = qty * price;
      const lineDisc = lineGross - pricing.amount;

      sub += lineGross;
      disc += lineDisc;
      tax += pricing.tax;

      return {
        amount: pricing.amount,
        tax: pricing.tax,
      };
    });

    const totals = computeOrderTotals(mappedLines);
    return {
      subtotal: Number(totals.subtotal.toFixed(2)),
      totalDiscount: Number(disc.toFixed(2)),
      totalTax: Number(totals.totalTax.toFixed(2)),
      grandTotal: Number(totals.totalAmount.toFixed(2)),
    };
  }, [lines, taxCategories, passedSubtotal, passedTotalTax, passedTotalDiscount, passedGrandTotal]);

  const columns: DataTableColumn<T>[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic DataTable column definition
    const cols: any[] = [
      {
        id: 'lineNumber',
        header: tSales('columns.lineNumber'),
        width: 32,
        render: (line: T, idx: number) => (
          <span className="text-[var(--text-muted)] font-normal text-xs relative">
            {line.lineNumber ?? idx + 1}
          </span>
        ),
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
      width: 85,
      align: 'right',
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
  ]);

  const amountColIndex = columns.findIndex((c) => c.id === 'amount');
  const footerColSpan = amountColIndex !== -1 ? amountColIndex : 8;

  return (
    <DataTable<T>
      data={lines || []}
      keyExtractor={(line: T, idx: number) => String(getLineIdentifier(line, idx))}
      columns={columns}
      emptyMessage={customEmptyMessage || tSales('noLineItems')}
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
              <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                {line.lineNumber ?? idx + 1}
              </div>
            </div>

            <div className="text-xs text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:!text-xs [&_.input]:h-7 [&_.input]:!py-1">
              <DescriptionCell
                line={line}
                lineIdentifier={lineId}
                isEditable={isLineEditable(line)}
                allowCatalogDescriptionEdit={allowCatalogDescriptionEdit}
                onUpdateLine={onUpdateLine}
              />
            </div>

            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
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
