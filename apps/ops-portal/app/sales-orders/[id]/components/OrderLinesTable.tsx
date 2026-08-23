'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { calculateUomPriceAdjustment, CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import type { OrderDetail, OrderLine, TaxCategory } from '../types';
import { getTaxLabel } from '../types';
import type { ProductUom } from '@herobm/shared';

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
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');

    const hasActionColumn = isOrderLinesEditable || (order.lines || []).some((l: OrderLine) => l.isPostConfirmation && isOrderDetailsEditable) || isPostConfirmationAddingEnabled;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const lineColumns: any[] = [
        {
            id: 'lineNumber',
            header: tSales('columns.lineNumber'),
            width: 32,
            render: (line: OrderLine) => (
                <span className="text-[var(--text-muted)] font-normal text-xs relative">
                    {line.lineNumber}
                </span>
            )
        },
        {
            id: 'product',
            header: tSales('columns.product'),
            width: 100,
            render: (line: OrderLine) => {
                const isComment = line.lineType === LineType.COMMENT;
                if (isComment) {
                    return (
                        <span className="font-semibold text-xs flex items-center">
                            <span className="text-[var(--text-muted)] font-medium text-xs">
                                COMMENT
                            </span>
                            {line.isPostConfirmation && (
                                <span className="ml-2 badge badge-sm badge-accent">
                                    {tSales('columns.postConfirmation')}
                                </span>
                            )}
                        </span>
                    );
                }
                const isCustom = !line.productId || line.productId === CUSTOM_LINE_ID || line.productId === '00000000-0000-0000-0000-000000000000' || line.productNumber === 'SYSTEM-CUSTOM-LINE';
                return (
                    <span className="font-semibold text-xs flex items-center">
                        {!isCustom && line.productId ? (
                            <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline hover:underline">
                                {line.productNumber || line.productId?.substring(0, 8)}
                            </Link>
                        ) : (
                            <span className="text-[var(--text-muted)] font-medium text-xs">CUSTOM</span>
                        )}
                        {line.isPostConfirmation && (
                            <span className="ml-2 badge badge-sm badge-accent">
                                {tSales('columns.postConfirmation')}
                            </span>
                        )}
                    </span>
                );
            }
        },
        {
            id: 'description',
            header: tSales('columns.description'),
            render: (line: OrderLine) => {
                const isComment = line.lineType === LineType.COMMENT;
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                return isEditable ? (
                    <input
                        className="input w-full !text-xs h-7 py-1"
                        defaultValue={line.productDescription || ''}
                        key={`desc-${line.salesOrderLineId}-${line.productDescription}`}
                        onBlur={(e) => {
                            if (e.target.value !== (line.productDescription || '')) {
                                updateLine(line.salesOrderLineId, 'productDescription', e.target.value);
                            }
                        }}
                        placeholder={isComment ? 'Enter note or comment...' : 'Custom description...'}
                    />
                ) : (
                    <span className="text-xs">{line.productDescription || '—'}</span>
                );
            }
        },
        {
            id: 'qty',
            header: tSales('columns.qty'),
            width: 70,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                
                const hasGap = isPreConfirmation && gapMap[line.salesOrderLineId] !== undefined;
                const isBackordered = !isPreConfirmation && line.productId && activeBackorders.has(line.productId);
                const hasWarning = hasGap || isBackordered;
                
                const warningTitle = hasGap ? tSales('availabilityStatus.shortage') : tSales('availabilityStatus.backordered');
                const warningIconStr = hasGap ? 'warning' : 'schedule';

                const warningIcon = hasWarning ? (
                    <span 
                        className={`material-symbols-outlined text-[13px] font-normal opacity-75 ${isEditable ? 'absolute -left-3.5 top-1/2 -translate-y-1/2 z-[1]' : 'relative align-middle mr-1'} ${hasGap ? 'text-rose-500' : 'text-amber-500'}`}
                        title={warningTitle}
                    >
                        {warningIconStr}
                    </span>
                ) : null;

                if (isEditable) {
                    return (
                        <div className="relative">
                            {warningIcon}
                            <input
                                className={`input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1 ${hasWarning ? (hasGap ? 'border-rose-300' : 'border-amber-300') : ''}`}
                                type="number"
                                min="0"
                                step="any"
                                defaultValue={parseFloat(line.quantity || '0')}
                                key={`qty-${line.salesOrderLineId}-${line.quantity}`}
                                onBlur={(e) => {
                                    if (e.target.value !== line.quantity) {
                                        updateLine(line.salesOrderLineId, 'quantity', e.target.value);
                                    }
                                }}
                            />
                        </div>
                    );
                }
                return (
                    <span className={`tabular-nums text-xs ${hasGap ? 'text-rose-600 font-medium' : ''}`}>
                        {warningIcon}
                        {parseFloat(line.quantity || '0')}
                    </span>
                );
            }
        },
        {
            id: 'uom',
            header: tSales('columns.uom'),
            width: 50,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                const defaultUom = line.baseUom || 'EA';
                const currentUom = line.unitOfMeasure || defaultUom;
                if (isEditable) {
                    const selectOptions: ProductUom[] = (line.productUoms || []).length > 0 ? (line.productUoms as ProductUom[]) : [{ uomCode: defaultUom, ratio: 1 }];
                    return (
                        <div className="relative w-full">
                            <div className="input w-full !text-xs text-center h-7 !px-1 py-1 flex items-center justify-center pointer-events-none bg-white">
                                <span className="tabular-nums">{currentUom}</span>
                            </div>
                            <select
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={currentUom}
                                onChange={(e) => {
                                    const newVal = e.target.value;
                                    const oldVal = currentUom;
                                    if (newVal !== oldVal) {
                                        const oldO = selectOptions.find((o) => o.uomCode === oldVal);
                                        const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
                                        const newO = selectOptions.find((o) => o.uomCode === newVal);
                                        const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);
                                        const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                                        updateLineFields(line.salesOrderLineId, {
                                            unitOfMeasure: newVal,
                                            pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2)
                                        });
                                    }
                                }}
                            >
                                {selectOptions.map((o) => (
                                    <option key={o.uomCode} value={o.uomCode}>{o.uomCode}</option>
                                ))}
                            </select>
                        </div>
                    );
                }
                return <span className="tabular-nums text-xs">{currentUom}</span>;
            }
        },
        {
            id: 'unitPrice',
            header: tSales('columns.unitPrice'),
            width: 80,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                if (isEditable) {
                    return (
                        <input
                            className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                            key={`price-${line.salesOrderLineId}-${line.pricePerUnit}`}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                                e.target.value = formatted;
                                if (formatted !== parseFloat(line.pricePerUnit || '0').toFixed(2)) {
                                    updateLine(line.salesOrderLineId, 'pricePerUnit', formatted);
                                }
                            }}
                        />
                    );
                }
                return <span className="tabular-nums text-xs">{formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}</span>;
            }
        },
        {
            id: 'unitCost',
            header: 'Unit Cost',
            width: 80,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                if (isEditable) {
                    return (
                        <input
                            className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={line.unitCost ? parseFloat(line.unitCost).toFixed(2) : ''}
                            key={`cost-${line.salesOrderLineId}-${line.unitCost}`}
                            placeholder="Auto"
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    if (line.unitCost !== null && line.unitCost !== undefined) {
                                        updateLine(line.salesOrderLineId, 'unitCost', null);
                                    }
                                    return;
                                }
                                const parsed = parseFloat(val);
                                const formatted = isNaN(parsed) ? '0.00' : parsed.toFixed(2);
                                e.target.value = formatted;
                                if (formatted !== (line.unitCost ? parseFloat(line.unitCost).toFixed(2) : null)) {
                                    updateLine(line.salesOrderLineId, 'unitCost', formatted);
                                }
                            }}
                        />
                    );
                }
                return <span className="tabular-nums text-[var(--text-muted)] text-xs">{line.unitCost ? formatAmount(parseFloat(line.unitCost), order.currencyCode || 'EUR') : tCommon('auto')}</span>;
            }
        },
        {
            id: 'discountPct',
            header: tSales('columns.discountPct'),
            width: 65,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                const discVal = parseFloat(line.discountPercentage || '0');
                const formattedDisc = isNaN(discVal) ? '0' : String(discVal);
                if (isEditable) {
                    return (
                        <input
                            className="input w-full text-right !text-xs tabular-nums h-7 !px-1.5 py-1"
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            defaultValue={formattedDisc}
                            key={`disc-${line.salesOrderLineId}-${line.discountPercentage}`}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                const clampedVal = isNaN(val) ? 0 : Math.min(Math.max(val, 0), 100);
                                const nextVal = String(clampedVal);
                                e.target.value = nextVal;
                                if (nextVal !== formattedDisc) {
                                    updateLine(line.salesOrderLineId, 'discountPercentage', nextVal);
                                }
                            }}
                        />
                    );
                }
                return <span className="tabular-nums text-xs">{formattedDisc}%</span>;
            }
        },
        {
            id: 'tax',
            header: (
                <div className="flex items-center justify-end gap-1">
                    {tSales('columns.tax')}
                    {isOrderDetailsEditable && (
                        <Button
                            type="button"
                            onClick={calculateTaxes}
                            disabled={saving}
                            className={`bg-transparent border-0 p-0 text-[var(--accent)] flex ${saving ? 'cursor-default' : 'cursor-pointer'}`}
                            title={tSales('buttons.calculateTaxes')}
                        >
                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon string constant. */}
                            <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>sync</span>
                        </Button>
                    )}
                </div>
            ),
            width: 65,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                const isExternalTax = !!order.taxProvider && order.taxProvider !== 'internal';

                if (isExternalTax) {
                    const isStale = order?.customFields?.taxIsStale === true || order?.customFields?.taxIsStale === 'true';
                    if (isStale) {
                        return <span className="badge badge-warning" title={tSales('taxNeedsToBeCalculated', { provider: order.taxProvider || '' })}>{tCommon('pending')}</span>;
                    }
                    return <span title={`Calculated by ${order.taxProvider}`} className="cursor-help border-b border-dotted border-[var(--text-muted)] text-xs">
                        {formatAmount(parseFloat(line.tax || '0'), order.currencyCode || 'EUR')}
                    </span>;
                }

                const selectedCat = taxCategories.find((c: TaxCategory) => c.taxCategoryId === line.taxCategoryId);
                const formattedPct = selectedCat
                    ? (() => {
                          const pct = parseFloat(selectedCat.rate || '0');
                          return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toString()}%`;
                      })()
                    : (() => {
                          const amt = parseFloat(line.amount || '0');
                          const tax = parseFloat(line.tax || '0');
                          if (amt > 0 && tax > 0) {
                              const pct = (tax / amt) * 100;
                              return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                          }
                          if (amt > 0 && tax === 0) return '0%';
                          return '—';
                      })();

                if (isEditable) {
                    return (
                        <div className="relative w-full">
                            <div className="input w-full !text-xs text-right h-7 !px-1.5 py-1 flex items-center justify-end pointer-events-none bg-white">
                                <span className="tabular-nums">{formattedPct}</span>
                            </div>
                            <select
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={line.taxCategoryId || ''}
                                onChange={(e) => {
                                    updateLine(line.salesOrderLineId, 'taxCategoryId', e.target.value);
                                }}
                                title={selectedCat ? getTaxLabel(selectedCat) : 'Tax Category'}
                            >
                                {taxCategories.map((c: TaxCategory) => (
                                    <option key={c.taxCategoryId} value={c.taxCategoryId}>
                                        {getTaxLabel(c)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                }
                return (
                    <span className="text-xs tabular-nums" title={selectedCat ? `Tax Category: ${selectedCat.title}` : undefined}>
                        {formattedPct}
                    </span>
                );
            }
        },
        {
            id: 'amount',
            header: tSales('columns.amount'),
            width: 85,
            align: 'right',
            render: (line: OrderLine) => {
                if (line.lineType === LineType.COMMENT) {
                    return <span className="text-[var(--text-muted)] text-xs">—</span>;
                }
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                return (
                    <span className={`font-semibold tabular-nums text-xs ${isEditable ? 'text-[var(--text-primary)]' : ''}`}>
                        {formatAmount(parseFloat(line.amount || '0'), order.currencyCode || 'EUR')}
                    </span>
                );
            }
        }
    ];

    if (hasActionColumn) {
        lineColumns.push({
            id: 'actions',
            header: '',
            width: 36,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                if (!isEditable) return null;
                return (
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(line.salesOrderLineId)}
                        title={tSales('buttons.removeLine')}
                    >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                    </Button>
                );
            }
        });
    }

    return (
        <DataTable
            data={order.lines}
            keyExtractor={(line: OrderLine, idx: number) => line.salesOrderLineId || idx}
            columns={lineColumns}
            emptyMessage={tSales('noLineItems')}
            mobileCard={(line: OrderLine) => {
                const actionCol = lineColumns.find(c => c.id === 'actions')?.render?.(line, 0);
                return (
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                        <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="font-semibold text-sm text-[var(--accent)]">
                                {lineColumns.find(c => c.id === 'product')?.render?.(line, 0)}
                            </div>
                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{line.lineNumber}</div>
                        </div>
                        <div className="text-xs text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:!text-xs [&_.input]:h-7 [&_.input]:!py-1">
                            {lineColumns.find(c => c.id === 'description')?.render?.(line, 0)}
                        </div>
                        <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                            {lineColumns.filter(c => ['qty', 'uom', 'unitCost', 'unitPrice', 'discountPct', 'tax', 'amount'].includes(c.id!)).map(col => (
                                <MobileCardField 
                                    key={col.id} 
                                    label={col.id === 'tax' ? tSales('columns.tax') : col.header} 
                                    value={
                                        <div className={col.id === 'amount' ? 'font-bold text-[var(--accent)] text-base' : '[&_.input]:!text-xs [&_.input]:h-7 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'}>
                                            {col.render?.(line, 0)}
                                        </div>
                                    } 
                                />
                            ))}
                            {actionCol && (
                                <div className="flex justify-end mt-2">
                                    {actionCol}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }}
            footer={
                (order.lines || []).length > 0 ? (() => {
                    const isExternalTax = !!order.taxProvider && order.taxProvider !== 'internal';
                    const isStale = isExternalTax && (order?.customFields?.taxIsStale === true || order?.customFields?.taxIsStale === 'true');
                    const taxPct = subtotal > 0 && !isStale ? (totalTax / subtotal) * 100 : 0;
                    return (
                        <>
                            <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
                                <td colSpan={9} className="text-right font-semibold text-[var(--text-muted)]">
                                    {tCommon('subtotal')}
                                </td>
                                <td className="text-right font-semibold tabular-nums">
                                    {formatAmount(subtotal, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="hidden lg:table-row">
                                <td colSpan={9} className="text-right font-semibold text-[var(--text-muted)]">
                                    {tCommon('tax')}{taxPct > 0 && !isStale ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                </td>
                                <td className="text-right font-semibold tabular-nums">
                                    {isStale ? <span className="badge badge-warning text-xs font-normal ml-auto">{tCommon('pending')}</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="hidden lg:table-row bg-blue-500/[0.02]">
                                <td colSpan={9} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
                                    {tCommon('total')}
                                </td>
                                <td className="text-right font-extrabold text-sm text-[var(--accent)] tabular-nums">
                                    {isStale ? <span className="badge badge-warning text-xs font-normal ml-auto">{tCommon('pending')}</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, order.currencyCode || 'EUR')}</td>
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal inline-block">{tCommon('pending')}</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}</td>
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                                <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal inline-block">{tCommon('pending')}</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}</td>
                            </tr>
                        </>
                    );
                })() : null
            }
        />
    );
}
