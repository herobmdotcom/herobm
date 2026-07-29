'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { calculateUomPriceAdjustment } from '@herobm/shared';
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
    gapMap: Record<string, number>;
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
            width: 40,
            render: (line: OrderLine) => (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, position: 'relative' }}>
                    {line.lineNumber}
                </span>
            )
        },
        {
            id: 'product',
            header: tSales('columns.product'),
            render: (line: OrderLine) => (
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                        <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                            {line.productNumber || line.productId?.substring(0, 8)}
                        </Link>
                    ) : (
                        line.productNumber || line.productId?.substring(0, 8) || '—'
                    )}
                    {line.isPostConfirmation && (
                        <span className="ml-2 badge badge-sm badge-accent">
                            {tSales('columns.postConfirmation')}
                        </span>
                    )}
                </span>
            )
        },
        {
            id: 'description',
            header: tSales('columns.description'),
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                return (!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isEditable ? (
                    <input
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                        defaultValue={line.productDescription || ''}
                        key={`desc-${line.salesOrderLineId}-${line.productDescription}`}
                        onBlur={(e) => {
                            if (e.target.value !== (line.productDescription || '')) {
                                updateLine(line.salesOrderLineId, 'productDescription', e.target.value);
                            }
                        }}
                        placeholder="Custom description..."
                    />
                ) : (
                    <>{line.productDescription || '—'}</>
                );
            }
        },
        {
            id: 'qty',
            header: tSales('columns.qty'),
            width: 90,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                
                const hasGap = isPreConfirmation && gapMap[line.salesOrderLineId] !== undefined;
                const isBackordered = !isPreConfirmation && line.productId && activeBackorders.has(line.productId);
                const hasWarning = hasGap || isBackordered;
                
                const warningTitle = hasGap ? tSales('availabilityStatus.shortage') : tSales('availabilityStatus.backordered');
                const warningColor = hasGap ? 'var(--danger)' : 'var(--warning)';
                const warningIconStr = hasGap ? 'warning' : 'schedule';

                const warningIcon = hasWarning ? (
                    <>
                        <span 
                            className="material-symbols-outlined" 
                            style={{ fontSize: 14, color: warningColor, position: isEditable ? 'absolute' : 'relative', left: isEditable ? -16 : undefined, top: isEditable ? '50%' : undefined, transform: isEditable ? 'translateY(-50%)' : undefined, verticalAlign: !isEditable ? 'middle' : undefined, marginRight: !isEditable ? 4 : 0, zIndex: 1 }}
                            title={warningTitle}
                        >
                            {warningIconStr}
                        </span>
                    </>
                ) : null;

                if (isEditable) {
                    return (
                        <div style={{ position: 'relative' }}>
                            {warningIcon}
                            <input
                                className="input"
                                type="number"
                                min="0"
                                step="1"
                                style={{ width: '100%', textAlign: 'right', borderColor: hasWarning ? warningColor : undefined }}
                                defaultValue={line.quantity}
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
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: hasGap ? 'var(--danger)' : undefined, fontWeight: hasGap ? 600 : undefined }}>
                        {warningIcon}
                        {line.quantity}
                    </span>
                );
            }
        },
        {
            id: 'uom',
            header: tSales('columns.uom'),
            width: 80,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                const defaultUom = line.baseUom || 'EA';
                if (isEditable) {
                    const selectOptions: ProductUom[] = (line.productUoms || []).length > 0 ? (line.productUoms as ProductUom[]) : [{ uomCode: defaultUom, ratio: 1 }];
                    return (
                        <select
                            className="input"
                            style={{ width: '100%', fontSize: 13, textAlign: 'right' }}
                            value={line.unitOfMeasure || defaultUom}
                            onChange={(e) => {
                                const newVal = e.target.value;
                                const oldVal = line.unitOfMeasure || defaultUom;
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
                    );
                }
                // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., UOM default).
                return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{line.unitOfMeasure || line.baseUom || 'EA'}</span>;
            }
        },
        {
            id: 'unitPrice',
            header: tSales('columns.unitPrice'),
            width: 110,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                if (isEditable) {
                    return (
                        <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: '100%', textAlign: 'right' }}
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
                return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}</span>;
            }
        },
        {
            id: 'discountPct',
            header: tSales('columns.discountPct'),
            width: 80,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                if (isEditable) {
                    return (
                        <input
                            className="input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            style={{ width: '100%', textAlign: 'right' }}
                            defaultValue={line.discountPercentage || '0'}
                            key={`disc-${line.salesOrderLineId}-${line.discountPercentage}`}
                            onBlur={(e) => {
                                if (e.target.value !== (line.discountPercentage || '0')) {
                                    updateLine(line.salesOrderLineId, 'discountPercentage', e.target.value);
                                }
                            }}
                        />
                    );
                }
                return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(line.discountPercentage || '0').toFixed(1)}%</span>;
            }
        },
        {
            id: 'tax',
            header: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {tSales('columns.tax')}
                    {isOrderDetailsEditable && (
                        <Button
                            type="button"
                            onClick={calculateTaxes}
                            disabled={saving}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: saving ? 'default' : 'pointer', color: 'var(--accent)', display: 'flex' }}
                            title={tSales('buttons.calculateTaxes')}
                        >
                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon string constant. */}
                            <span className={`material-symbols-outlined ${saving ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>sync</span>
                        </Button>
                    )}
                </div>
            ),
            width: 110,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                const isExternalTax = !!order.taxProvider && order.taxProvider !== 'internal';

                if (isExternalTax) {
                    const isStale = order?.customFields?.taxIsStale === true || order?.customFields?.taxIsStale === 'true';
                    if (isStale) {
                        return <span className="badge badge-warning" title={tSales('taxNeedsToBeCalculated', { provider: order.taxProvider || '' })}>{tCommon('pending')}</span>;
                    }
                    return <span title={`Calculated by ${order.taxProvider}`} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>
                        {formatAmount(parseFloat(line.tax || '0'), order.currencyCode || 'EUR')}
                    </span>;
                }

                if (isEditable) {
                    return (
                        <select
                            className="input"
                            style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                            value={line.taxCategoryId || ''}
                            onChange={(e) => {
                                updateLine(line.salesOrderLineId, 'taxCategoryId', e.target.value);
                            }}
                        >
                            {taxCategories.map((c: TaxCategory) => (
                                <option key={c.taxCategoryId} value={c.taxCategoryId}>
                                    {getTaxLabel(c)}
                                </option>
                            ))}
                        </select>
                    );
                }
                return (
                    <span style={{ fontSize: 12 }}>
                        {(() => {
                            const c = taxCategories.find((c: TaxCategory) => c.taxCategoryId === line.taxCategoryId);
                            if (c) {
                                const pct = parseFloat(c.rate || '0');
                                const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
                                return <span title={`Tax Category: ${c.title}`} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>{formattedPct}%</span>;
                            }
                            const amt = parseFloat(line.amount || '0');
                            const tax = parseFloat(line.tax || '0');
                            if (amt > 0 && tax > 0) {
                                const pct = (tax / amt) * 100;
                                return <span title="Tax Category: Custom" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>{`${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`}</span>;
                            }
                            if (amt > 0 && tax === 0) return <span title={tCommon('taxLabels.exempt')} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>0%</span>;
                            return '—';
                        })()}
                    </span>
                );
            }
        },
        {
            id: 'amount',
            header: tSales('columns.amount'),
            width: 110,
            align: 'right',
            render: (line: OrderLine) => {
                const isEditable = isOrderLinesEditable || (line.isPostConfirmation && isOrderDetailsEditable);
                return (
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isEditable ? 'var(--text-primary)' : undefined }}>
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
            width: 50,
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
                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                        </div>
                        <div className="text-sm text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1">
                            {lineColumns.find(c => c.id === 'description')?.render?.(line, 0)}
                        </div>
                        <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                            {lineColumns.filter(c => ['qty', 'uom', 'unitPrice', 'discountPct', 'tax', 'amount'].includes(c.id!)).map(col => (
                                <MobileCardField 
                                    key={col.id} 
                                    label={col.id === 'tax' ? tSales('columns.tax') : col.header} 
                                    value={
                                        <div className={col.id === 'amount' ? 'font-bold text-[var(--accent)] text-base' : '[&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'}>
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
                            <tr className="hidden lg:table-row" style={{ borderTop: '2px solid var(--border)' }}>
                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    {tCommon('subtotal')}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatAmount(subtotal, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="hidden lg:table-row">
                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    {tCommon('tax')}{taxPct > 0 && !isStale ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>{tCommon('pending')}</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="hidden lg:table-row" style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                    {tCommon('total')}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                    {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>{tCommon('pending')}</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                                </td>
                                {hasActionColumn && <td></td>}
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, order.currencyCode || 'EUR')}</td>
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal" style={{ display: 'inline-block' }}>{tCommon('pending')}</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}</td>
                            </tr>
                            <tr className="lg:hidden">
                                <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                                <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{isStale ? <span className="badge badge-warning text-[10px] font-normal" style={{ display: 'inline-block' }}>{tCommon('pending')}</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}</td>
                            </tr>
                        </>
                    );
                })() : null
            }
        />
    );
}
