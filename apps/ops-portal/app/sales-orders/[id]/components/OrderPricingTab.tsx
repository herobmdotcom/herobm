'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import type { OrderDetail, OrderLine, PricingHistoryEntry } from '../types';
import { OrderPricingSlideOver } from './OrderPricingSlideOver';

interface OrderPricingTabProps {
    order: OrderDetail;
}

interface ProductPricingState {
    entries: PricingHistoryEntry[];
    total: number;
    loading: boolean;
}

export function OrderPricingTab({ order }: OrderPricingTabProps) {
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');

    const [pricingMap, setPricingMap] = useState<Record<string, ProductPricingState>>({});
    const [activeSlideOverProduct, setActiveSlideOverProduct] = useState<{
        productId: string;
        productNumber: string;
        productDescription: string;
    } | null>(null);

    const distinctProductIds = useMemo(() => {
        const ids = new Set<string>();
        for (const line of order.lines || []) {
            if (line.productId && line.productId !== '00000000-0000-4000-8000-000000000000') {
                ids.add(line.productId);
            }
        }
        return Array.from(ids);
    }, [order.lines]);

    const fetchProductPricing = useCallback(async (productId: string) => {
        setPricingMap((prev) => ({
            ...prev,
            [productId]: { entries: prev[productId]?.entries || [], total: prev[productId]?.total || 0, loading: true },
        }));

        try {
            const res = await api.ordersControllerGetProductPricingHistory({
                productId,
                customerId: order.customerId || undefined,
                excludeOrderId: order.salesOrderId || undefined,
                page: 1,
                limit: 3,
            });

            const payload = res.data as unknown as {
                data: PricingHistoryEntry[];
                total: number;
            };

            setPricingMap((prev) => ({
                ...prev,
                [productId]: {
                    entries: payload?.data || [],
                    total: payload?.total || 0,
                    loading: false,
                },
            }));
        } catch (err) {
            reportError(err, 'OrderPricingTab:fetchProductPricing');
            toast.error(getErrorMessage(err));
            setPricingMap((prev) => ({
                ...prev,
                [productId]: { entries: [], total: 0, loading: false },
            }));
        }
    }, [order.customerId, order.salesOrderId]);

    useEffect(() => {
        for (const pid of distinctProductIds) {
            fetchProductPricing(pid);
        }
    }, [distinctProductIds, fetchProductPricing]);

    const lines = order.lines || [];

    return (
        <div className="w-full space-y-4">
            <DataTable<OrderLine>
                data={lines}
                keyExtractor={(line, idx) => line.salesOrderLineId || idx}
                emptyMessage={tSales('noLineItems')}
                columns={[
                    { header: tSales('columns.lineNumber'), width: 48, align: 'center' },
                    { header: tSales('columns.product'), width: 180 },
                    { header: tSales('columns.description'), width: 220 },
                    { header: tSales('pricing.currentPrice'), width: 170 },
                    { header: tSales('pricing.recentOrders') },
                    { header: '', width: 130, align: 'right' },
                ]}
                renderCustomRow={(line, idx) => {
                    const hasProduct = Boolean(line.productId && line.productId !== '00000000-0000-4000-8000-000000000000');
                    const productState = hasProduct && line.productId ? pricingMap[line.productId] : null;
                    const recentEntries = productState?.entries || [];
                    const isLoading = productState?.loading ?? false;
                    const totalHistory = productState?.total ?? 0;

                    return (
                        <tr key={line.salesOrderLineId || idx}>
                            <td className="w-12 text-center text-[var(--text-muted)] font-medium text-xs">
                                {line.lineNumber || idx + 1}
                            </td>
                            <td>
                                {hasProduct && line.productId ? (
                                    <Link
                                        href={`/products/${line.productId}`}
                                        className="text-[var(--accent)] no-underline hover:underline font-mono text-xs font-semibold"
                                    >
                                        {line.productNumber || line.productId.substring(0, 8)}
                                    </Link>
                                ) : (
                                    <span className="text-[var(--text-muted)] font-medium text-xs font-mono">
                                        {line.productNumber || '—'}
                                    </span>
                                )}
                            </td>
                            <td>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {line.productDescription || '—'}
                                </span>
                            </td>
                            <td>
                                <span className="font-semibold text-xs text-[var(--text-primary)] font-mono tabular-nums">
                                    {formatAmount(Number(line.pricePerUnit), order.currencyCode)} @ {line.quantity} {line.unitOfMeasure || ''}
                                </span>
                            </td>
                            <td>
                                {!hasProduct ? (
                                    <span className="text-xs text-[var(--text-muted)] italic">
                                        {tSales('pricing.nonProductLine')}
                                    </span>
                                ) : isLoading && recentEntries.length === 0 ? (
                                    <span className="text-xs text-[var(--text-muted)]">
                                        {tCommon('loading')}
                                    </span>
                                ) : recentEntries.length === 0 ? (
                                    <span className="text-xs text-[var(--text-muted)] italic">
                                        {tSales('pricing.noHistory')}
                                    </span>
                                ) : (
                                    <div className="flex flex-col gap-1 py-0.5">
                                        {recentEntries.map((entry, entryIdx) => (
                                            <div
                                                key={`${entry.salesOrderId}-${entryIdx}`}
                                                className={`flex items-center gap-2 text-xs flex-wrap px-2 py-0.5 rounded border border-[var(--border)] ${
                                                    entry.isCurrentCustomer
                                                        ? 'bg-[var(--accent-subtle)]/25 border-[var(--accent-subtle)]'
                                                        : 'bg-[var(--bg-secondary)]/50'
                                                }`}
                                            >
                                                {entry.isCurrentCustomer ? (
                                                    <span className="badge badge-success text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {tSales('pricing.thisCustomer')}
                                                    </span>
                                                ) : (
                                                    <span className="font-medium text-[var(--text-secondary)]">
                                                        {entry.customerName}:
                                                    </span>
                                                )}

                                                <span className="font-mono font-semibold text-[var(--text-primary)]">
                                                    {formatAmount(Number(entry.pricePerUnit), entry.currencyCode)} @ {entry.quantity} {entry.unitOfMeasure || ''}
                                                </span>

                                                <Link
                                                    href={routes.salesOrders.detail(entry.salesOrderId)}
                                                    className="font-medium text-[var(--accent)] hover:underline ml-1"
                                                >
                                                    {entry.orderNumber}
                                                </Link>

                                                <span className="text-[11px] text-[var(--text-muted)]">
                                                    {formatLocalDate(entry.orderDate)}
                                                </span>

                                                <div className="ml-auto">
                                                    <StateBadge state={(entry.stateCode || 'DRAFT') as ValidState} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="text-right">
                                {hasProduct && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="!text-xs h-7 !py-1 !px-2"
                                        onClick={() =>
                                            setActiveSlideOverProduct({
                                                productId: line.productId!,
                                                productNumber: line.productNumber || 'Product',
                                                productDescription: line.productDescription || '',
                                            })
                                        }
                                        title={tSales('pricing.viewAll')}
                                    >
                                        {tSales('pricing.viewAllWithCount', { count: totalHistory })}
                                    </Button>
                                )}
                            </td>
                        </tr>
                    );
                }}
                mobileCard={(line) => {
                    const hasProduct = Boolean(line.productId && line.productId !== '00000000-0000-4000-8000-000000000000');
                    const productState = hasProduct && line.productId ? pricingMap[line.productId] : null;
                    const recentEntries = productState?.entries || [];
                    const totalHistory = productState?.total ?? 0;

                    return (
                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <div className="font-semibold text-xs text-[var(--text-primary)] font-mono">
                                        {line.productNumber || line.productDescription || '—'}
                                    </div>
                                    {line.productNumber && line.productDescription && (
                                        <div className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                                            {line.productDescription}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">
                                    #{line.lineNumber || '—'}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-2 text-xs">
                                <MobileCardField
                                    label={tSales('pricing.currentPrice')}
                                    value={`${formatAmount(Number(line.pricePerUnit), order.currencyCode)} @ ${line.quantity} ${line.unitOfMeasure || ''}`}
                                />
                            </div>

                            {/* Recent Orders in Mobile */}
                            {hasProduct && recentEntries.length > 0 && (
                                <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                                    <div className="text-xs font-semibold text-[var(--text-secondary)]">
                                        {tSales('pricing.recentOrders')}:
                                    </div>
                                    {recentEntries.map((entry, entryIdx) => (
                                        <div
                                            key={`${entry.salesOrderId}-${entryIdx}`}
                                            className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-[var(--bg-secondary)]"
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1">
                                                    {entry.isCurrentCustomer && (
                                                        <span className="badge badge-success text-[9px] font-bold px-1 rounded">
                                                            {tSales('pricing.thisCustomer')}
                                                        </span>
                                                    )}
                                                    <span className="font-mono font-medium">
                                                        {formatAmount(Number(entry.pricePerUnit), entry.currencyCode)} @ {entry.quantity}
                                                    </span>
                                                </div>
                                                <Link
                                                    href={routes.salesOrders.detail(entry.salesOrderId)}
                                                    className="text-[11px] text-[var(--accent)] hover:underline mt-0.5"
                                                >
                                                    {entry.orderNumber} ({formatLocalDate(entry.orderDate)})
                                                </Link>
                                            </div>
                                            <StateBadge state={(entry.stateCode || 'DRAFT') as ValidState} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {hasProduct && (
                                <div className="pt-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full justify-center"
                                        onClick={() =>
                                            setActiveSlideOverProduct({
                                                productId: line.productId!,
                                                productNumber: line.productNumber || 'Product',
                                                productDescription: line.productDescription || '',
                                            })
                                        }
                                    >
                                        {tSales('pricing.viewAllWithCount', { count: totalHistory })}
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                }}
            />

            {/* SlideOver for Full Product Order History */}
            {activeSlideOverProduct && (
                <OrderPricingSlideOver
                    isOpen={Boolean(activeSlideOverProduct)}
                    onClose={() => setActiveSlideOverProduct(null)}
                    productId={activeSlideOverProduct.productId}
                    productNumber={activeSlideOverProduct.productNumber}
                    productDescription={activeSlideOverProduct.productDescription}
                    currentCustomerId={order.customerId}
                    currentCustomerName={order.customerName || ''}
                    currentOrderId={order.salesOrderId}
                />
            )}
        </div>
    );
}

export default OrderPricingTab;
