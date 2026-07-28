'use client';

import { Fragment, useState } from 'react';
import { Button } from '@/components/shared/Button';
import Link from 'next/link';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { isPhysicalProductLine } from '@herobm/shared';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import type { TaxCategory, OrderLine, OrderDetail } from './types';
import { getTaxLabel } from './types';
import { SALES_ORDER_STATE, SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE, BACKORDER_STATE, calculateUomPriceAdjustment, calculateInventoryGaps } from '@herobm/shared';
import type { ProductUom } from '@herobm/shared';
import type { Product } from '@/components/shared/ProductSearchInput';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';

interface OrderLinesTabProps {
    order: OrderDetail | null | undefined;
    saving: boolean;
    editFulfillmentLocationId: string | null;
    inventoryData: import('./types').InventoryLevel[];
    inventoryLoading: boolean;
    activeBackorders: Set<string>;
    gapMap: Record<string, number>;
    isOrderLinesEditable: boolean;
    isOrderDetailsEditable: boolean;
    isPostConfirmationAddingEnabled: boolean;
    setIsPostConfirmationAddingEnabled: (val: boolean) => void;
    addLineFromProduct: (product: Product) => void;
    addBlankLine: () => void;
    updateLine: (lineId: string, field: string, value: string | boolean | null | undefined | number) => Promise<void> | void;
    updateLineFields: (lineId: string, fields: Partial<OrderLine>) => Promise<void> | void;
    removeLine: (lineId: string) => void;
    calculateTaxes: () => void;
    taxCategories: TaxCategory[];
    subtotal: number;
    totalTax: number;
    activeTab: 'lines' | 'availability' | 'backorders';
    setActiveTab: (tab: 'lines' | 'availability' | 'backorders') => void;
}

export default function OrderLinesTab({
    order,
    saving,
    editFulfillmentLocationId,
    inventoryData,
    inventoryLoading,
    activeBackorders,
    gapMap,
    isOrderLinesEditable,
    isOrderDetailsEditable,
    isPostConfirmationAddingEnabled,
    setIsPostConfirmationAddingEnabled,
    addLineFromProduct,
    addBlankLine,
    updateLine,
    updateLineFields,
    removeLine,
    calculateTaxes,
    taxCategories,
    subtotal,
    totalTax,
    activeTab,
    setActiveTab,
}: OrderLinesTabProps) {
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    
    if (!order) return null;
    
    const isPreConfirmation = order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED;
    const isShipped = ([SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.ARCHIVED, SALES_ORDER_STATE.CANCELLED] as string[]).includes(order.stateCode as string);

    return (
        <div className="max-w-5xl">
            <div id="lines-section" className="card">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
                        <div className="flex gap-0 min-w-max">
                            <Button
                                className="text-xs font-medium px-3 py-1.5 rounded-l-lg"
                                style={{
                                    color: activeTab === 'lines' ? 'var(--accent)' : 'var(--text-muted)',
                                    background: activeTab === 'lines' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: '1px solid',
                                    borderColor: activeTab === 'lines' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveTab('lines')}
                            >
                                {tSales('lineItems')}
                            </Button>
                            <Button
                                className="text-xs font-medium px-3 py-1.5"
                                style={{
                                    color: activeTab === 'availability' ? 'var(--accent)' : 'var(--text-muted)',
                                    background: activeTab === 'availability' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: '1px solid',
                                    borderColor: activeTab === 'availability' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                                    borderLeft: activeTab === 'availability' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveTab('availability')}
                            >
                                {tSales('availability')}
                            </Button>
                            <Button
                                className="text-xs font-medium px-3 py-1.5 rounded-r-lg"
                                style={{
                                    color: activeTab === 'backorders' ? 'var(--accent)' : 'var(--text-muted)',
                                    background: activeTab === 'backorders' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: '1px solid',
                                    borderColor: activeTab === 'backorders' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                                    borderLeft: activeTab === 'backorders' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveTab('backorders')}
                            >
                                {tSales('backordersTab')}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                        {(isOrderLinesEditable || (isOrderDetailsEditable && activeTab === 'lines' && isPostConfirmationAddingEnabled)) && (
                            <>
                                <div className="flex-1 min-w-[200px] max-w-sm">
                                    <ProductSearchInput
                                        onSelect={addLineFromProduct}
                                        placeholder={tSales('placeholders.searchProduct')}
                                        style={{ width: '100%' }}
                                        fulfillmentLocationId={editFulfillmentLocationId || order?.fulfillmentLocationId || undefined}
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="whitespace-nowrap"
                                    onClick={addBlankLine}
                                    disabled={saving}
                                >
                                    {tSales('buttons.customLine')}
                                </Button>
                            </>
                        )}
                        {!isOrderLinesEditable && isOrderDetailsEditable && activeTab === 'lines' && !isPostConfirmationAddingEnabled && (ORDER_LIFECYCLE[order?.stateCode ?? ''] >= ORDER_LIFECYCLE[SALES_ORDER_STATE.CONFIRMED]) && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="whitespace-nowrap"
                                onClick={() => {
                                    if (window.confirm(tSales('postConfirmationLineWarningBody'))) {
                                        setIsPostConfirmationAddingEnabled(true);
                                    }
                                }}
                                disabled={saving}
                                title={tSales('postConfirmationLineWarningTitle')}
                            >
                                {tSales('buttons.addPostConfirmationLine')}
                            </Button>
                        )}
                    </div>
                </div>

                {activeTab === 'lines' ? (() => {
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
                                            {(isOrderLinesEditable || (order.lines || []).some((l: OrderLine) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
                                        </tr>
                                        <tr className="hidden lg:table-row">
                                            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                {tCommon('tax')}{taxPct > 0 && !isStale ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>{tCommon('pending')}</span> : formatAmount(totalTax, order.currencyCode || 'EUR')}
                                            </td>
                                            {(isOrderLinesEditable || (order.lines || []).some((l: OrderLine) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
                                        </tr>
                                        <tr className="hidden lg:table-row" style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                                            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                                {tCommon('total')}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                                                {isStale ? <span className="badge badge-warning text-xs font-normal" style={{ marginLeft: 'auto' }}>{tCommon('pending')}</span> : formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                                            </td>
                                            {(isOrderLinesEditable || (order.lines || []).some((l: OrderLine) => l.isPostConfirmation && isOrderDetailsEditable)) && <td></td>}
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
                })() : activeTab === 'availability' ? (
                    inventoryLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tSales('loadingInventory')}</p>
                    ) : (
                        <DataTable
                            data={(order.lines || []).filter(isPhysicalProductLine)}
                            keyExtractor={(line: OrderLine, idx: number) => line.salesOrderLineId || idx}
                            emptyMessage={tSales('noLineItemsShort')}
                            columns={[
                                { header: tSales('columns.lineNumber'), width: 40 },
                                { header: tSales('columns.product') },
                                { header: tSales('columns.description') },
                                { header: tSales('columns.qty'), align: 'right' },
                                { header: tSales('columns.status') },
                                { header: tSales('columns.location'), align: 'right' },
                                { header: tSales('availabilityTable.avail'), align: 'right' },
                            ]}
                            renderCustomRow={(line: OrderLine, idx: number) => {
                                const lineInventory = inventoryData.filter(
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                    (inv: any) => inv.productId === line.productId && line.productId !== '00000000-0000-0000-0000-000000000000',
                                );
                                const totalAvail = lineInventory.reduce(
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                    (sum: number, inv: any) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                                );
                                const gap = gapMap[line.salesOrderLineId];
                                const canFulfil = !gap;

                                return (
                                    <Fragment key={line.salesOrderLineId || idx}>
                                        {lineInventory.length === 0 ? (
                                            <tr key={line.salesOrderLineId}>
                                                <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                                <td style={{ fontWeight: 600, fontSize: 12 }}>
                                                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                        <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                            {line.productNumber}
                                                        </Link>
                                                    ) : (
                                                        line.productNumber || '—'
                                                    )}
                                                </td>
                                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{line.productDescription}</td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                                                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 12, fontStyle: 'italic' }}>
                                                    {tSales('noInventoryFound')}
                                                </td>
                                            </tr>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                        ) : lineInventory.map((inv: any, idx: number) => (
                                            <tr key={`${line.salesOrderLineId}-${inv.locationId}`}>
                                                {idx === 0 && (
                                                    <>
                                                        <td rowSpan={lineInventory.length} style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                                        <td rowSpan={lineInventory.length} style={{ fontWeight: 600, fontSize: 12 }}>
                                                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                                <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                                    {line.productNumber}
                                                                </Link>
                                                            ) : (
                                                                line.productNumber || '—'
                                                            )}
                                                        </td>
                                                        <td rowSpan={lineInventory.length} style={{ fontSize: 12 }}>{line.productDescription}</td>
                                                        <td rowSpan={lineInventory.length} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{line.quantity}</td>
                                                        <td rowSpan={lineInventory.length}>
                                                            {(() => {
                                                                if (isShipped) {
                                                                    return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.shipped')}</span>;
                                                                }
                                                                if (!isPreConfirmation) {
                                                                    const pickedQty = parseFloat(line.quantityPicked || '0');
                                                                    if (pickedQty > 0 && pickedQty >= parseFloat(line.quantity as string)) {
                                                                        return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.picked')}</span>;
                                                                    }
                                                                    
                                                                    const isBackordered = line.productId && activeBackorders.has(line.productId);
                                                                    if (isBackordered) {
                                                                        return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.backordered')}</span>;
                                                                    }
                                                                    
                                                                    const locId = editFulfillmentLocationId || order.fulfillmentLocationId;
                                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                                                    const locInv = lineInventory.find((i: any) => i.locationId === locId);
                                                                    const isAtRisk = locInv && parseFloat(locInv.quantityAvailable || '0') < 0;
                                                                    if (isAtRisk) {
                                                                        return <span className="text-rose-600 font-medium">{tSales('availabilityStatus.atRisk')}</span>;
                                                                    }
                                                                    
                                                                    return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.local')}</span>;
                                                                }
                                                                // Draft Logic
                                                                if (canFulfil) {
                                                                    return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.local')}</span>;
                                                                }
                                                                if (gap && totalAvail >= gap) {
                                                                    return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.others')}</span>;
                                                                }
                                                                return <span className="text-rose-600 font-medium">{tSales('availabilityStatus.shortage')}</span>;
                                                            })()}
                                                        </td>
                                                    </>
                                                )}
                                                <td style={{ textAlign: 'right', fontSize: 12 }}>
                                                    <Link href={`/products/${line.productId}?tab=inventory`} style={{ color: inv.locationId === (editFulfillmentLocationId || order.fulfillmentLocationId) ? 'var(--accent)' : 'var(--text-muted)', fontWeight: inv.locationId === (editFulfillmentLocationId || order.fulfillmentLocationId) ? 600 : 400, textDecoration: 'none' }}>
                                                        {inv.locationName}
                                                    </Link>
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: parseFloat(inv.quantityAvailable || '0') > 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                                                    {parseFloat(inv.quantityAvailable || '0')}
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                );
                            }}
                            mobileCard={(line: OrderLine) => {
                                const lineInventory = inventoryData.filter(
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                    (inv: any) => inv.productId === line.productId && line.productId !== '00000000-0000-0000-0000-000000000000',
                                );
                                const totalAvail = lineInventory.reduce(
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                    (sum: number, inv: any) => sum + parseFloat(inv.quantityAvailable || '0'), 0,
                                );
                                const gap = gapMap[line.salesOrderLineId];
                                const canFulfil = !gap;

                                return (
                                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <div className="font-semibold text-sm text-[var(--accent)]">
                                                {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                            </div>
                                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                                        </div>
                                        <div className="text-sm text-slate-600 font-medium mb-3">
                                            {line.productDescription}
                                        </div>
                                        
                                        {lineInventory.length === 0 ? (
                                            <div className="text-sm text-rose-500 italic text-center py-2 bg-rose-50 rounded border border-rose-100">{tSales('noInventoryFound')}</div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center py-2 border-t border-slate-100">
                                                    <span className="text-xs font-medium text-slate-500">{tSales('columns.ordered')}</span>
                                                    <span className="text-sm font-semibold">{line.quantity}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                    <span className="text-xs font-medium text-slate-500">{tSales('columns.fulfillment')}</span>
                                                    <span className="text-sm font-medium">
                                                        {(() => {
                                                            if (isShipped) return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.shipped')}</span>;
                                                            if (!isPreConfirmation) {
                                                                const pickedQty = parseFloat(line.quantityPicked || '0');
                                                                if (pickedQty > 0 && pickedQty >= parseFloat(line.quantity as string)) return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.picked')}</span>;
                                                                const isBackordered = line.productId && activeBackorders.has(line.productId);
                                                                if (isBackordered) return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.backordered')}</span>;
                                                                const locId = editFulfillmentLocationId || order.fulfillmentLocationId;
                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                                                                const locInv = lineInventory.find((i: any) => i.locationId === locId);
                                                                const isAtRisk = locInv && parseFloat(locInv.quantityAvailable || '0') < 0;
                                                                if (isAtRisk) return <span className="text-rose-600 font-medium">{tSales('availabilityStatus.atRisk')}</span>;
                                                                return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.local')}</span>;
                                                            }
                                                            if (canFulfil) return <span className="text-emerald-600 font-medium">{tSales('availabilityStatus.local')}</span>;
                                                            if (gap && totalAvail >= gap) return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.others')}</span>;
                                                            return <span className="text-rose-600 font-medium">{tSales('availabilityStatus.shortage')}</span>;
                                                        })()}
                                                    </span>
                                                </div>
                                                
                                                <div className="mt-3 flex flex-col gap-2">
                                                    <span className="text-xs font-medium text-slate-500">{tSales('columns.location')}:</span>
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee */}
                                                    {lineInventory.map((inv: any) => (
                                                        <div key={inv.locationId} className="bg-slate-50 rounded p-2 text-xs flex flex-col gap-1 border border-slate-100">
                                                            <div className="flex justify-between font-medium">
                                                                <Link href={`/products/${line.productId}?tab=inventory`} className={inv.locationId === (editFulfillmentLocationId || order.fulfillmentLocationId) ? 'text-[var(--accent)]' : ''}>
                                                                    {inv.locationName}
                                                                </Link>
                                                                <span className={parseFloat(inv.quantityAvailable) >= parseFloat(line.quantity as string) ? 'text-emerald-600' : 'text-rose-600'}>{parseFloat(inv.quantityAvailable)} {tSales('availabilityTable.avail')}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    )
                ) : (
                    /* Backorders tab */
                    <div>
                        <DataTable
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Props
                            data={(order.backorders || []) as any[]}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                            keyExtractor={(bo: any, idx: number) => bo.salesOrderLineId || bo.purchaseOrderId || idx}
                            emptyMessage={tSales('noBackordersFound')}
                            columns={[
                                { header: tSales('columns.lineNumber') },
                                { header: tSales('columns.product') },
                                { header: tSales('columns.allocatedTo') },
                                { header: tSales('columns.soStatus') },
                                { header: tSales('columns.poStatus') },
                                { header: tSales('columns.demandDate') },
                            ]}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                            renderCustomRow={(bo: any, bo_idx: number) => {
                                const isPo = !!bo.purchaseOrderId;
                                const isTo = !!bo.transferOrderId;
                                const isAllocated = isPo || isTo;
                                const displayOrderNumber = isPo ? bo.purchaseOrderNumber : isTo ? bo.transferOrderNumber : '—';
                                
                                return (
                                    <tr key={bo_idx}>
                                        <td className="w-12 text-center text-[var(--text-muted)] font-medium">
                                            {bo.lineNumber || '—'}
                                        </td>
                                        <td>
                                            {bo.productNumber || '—'}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tSales('demandedQty', { qty: bo.quantity || '0' })}</div>
                                        </td>
                                        <td>
                                            {isAllocated ? (
                                                <Link 
                                                    href={isPo ? `/purchase-orders/${bo.purchaseOrderId}` : `/transfers/${bo.transferOrderId}`}
                                                    className="text-[var(--accent)] font-medium hover:underline"
                                                >
                                                    {displayOrderNumber}
                                                </Link>
                                            ) : (
                                                <span className="text-[var(--text-muted)] font-normal">{displayOrderNumber}</span>
                                            )}
                                        </td>
                                        <td>
                                            {isAllocated ? (
                                                <span className="badge badge-success">{tSales('allocated')}</span>
                                            ) : (
                                                <span className="badge badge-draft">{tSales('openDemandBadge')}</span>
                                            )}
                                        </td>
                                        <td>
                                            {isAllocated ? (
                                                <StateBadge state={(isPo ? bo.purchaseOrderState : bo.transferOrderState) || 'DRAFT'} />
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td>{new Date(bo.createdOn).toLocaleDateString()}</td>
                                    </tr>
                                );
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                            mobileCard={(bo: any) => {
                                const isPo = !!bo.purchaseOrderId;
                                const isTo = !!bo.transferOrderId;
                                const isAllocated = isPo || isTo;
                                const displayOrderNumber = isPo ? bo.purchaseOrderNumber : isTo ? bo.transferOrderNumber : '—';
                                
                                return (
                                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <div className="font-semibold text-sm text-[var(--text-primary)]">
                                                {bo.productNumber || '—'}
                                            </div>
                                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{bo.lineNumber || '—'}</div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-0 border-t border-slate-100 pt-1 mt-2">
                                            <MobileCardField label={tSales('columns.allocatedTo')} value={
                                                isAllocated ? (
                                                    <Link 
                                                        href={isPo ? `/purchase-orders/${bo.purchaseOrderId}` : `/transfers/${bo.transferOrderId}`}
                                                        className="text-[var(--accent)] font-medium hover:underline"
                                                    >
                                                        {displayOrderNumber}
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-400">{displayOrderNumber}</span>
                                                )
                                            } />
                                            <MobileCardField label={tSales('columns.demandDate')} value={
                                                new Date(bo.createdOn).toLocaleDateString()
                                            } />
                                            <MobileCardField label={tSales('demandedQty', { qty: bo.quantity || '0' })} value={
                                                isAllocated ? (
                                                    <span className="badge badge-success">{tSales('allocated')}</span>
                                                ) : (
                                                    <span className="badge badge-draft">{tSales('openDemandBadge')}</span>
                                                )
                                            } />
                                            <MobileCardField label={tSales('columns.poStatus')} value={
                                                isAllocated ? (
                                                    <StateBadge state={(isPo ? bo.purchaseOrderState : bo.transferOrderState) || 'DRAFT'} />
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )
                                            } />
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
