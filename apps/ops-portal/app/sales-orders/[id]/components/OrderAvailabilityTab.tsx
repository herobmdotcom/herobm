'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { isPhysicalProductLine } from '@herobm/shared';
import { DataTable } from '@/components/shared/DataTable';
import type { OrderDetail, OrderLine } from '../types';

interface OrderAvailabilityTabProps {
    order: OrderDetail;
    inventoryData: import('../types').InventoryLevel[];
    inventoryLoading: boolean;
    gapMap: Record<string, import('@herobm/shared').InventoryGap>;
    activeBackorders: Set<string>;
    editFulfillmentLocationId: string | null;
    isPreConfirmation: boolean;
    isShipped: boolean;
}

export function OrderAvailabilityTab({
    order,
    inventoryData,
    inventoryLoading,
    gapMap,
    activeBackorders,
    editFulfillmentLocationId,
    isPreConfirmation,
    isShipped,
}: OrderAvailabilityTabProps) {
    const tSales = useTranslations('salesOrders');

    if (inventoryLoading) {
        return <p className="text-sm text-[var(--text-muted)] py-5 text-center">{tSales('loadingInventory')}</p>;
    }

    return (
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
                                <td className="text-[var(--text-muted)]">{line.lineNumber}</td>
                                <td className="font-semibold text-xs">
                                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                        <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline">
                                            {line.productNumber}
                                        </Link>
                                    ) : (
                                        line.productNumber || '—'
                                    )}
                                </td>
                                <td className="text-xs text-[var(--text-muted)]">{line.productDescription}</td>
                                <td className="text-right tabular-nums">{parseFloat(line.quantity || '0')}</td>
                                <td colSpan={3} className="text-center text-[var(--danger)] text-xs italic">
                                    {tSales('noInventoryFound')}
                                </td>
                            </tr>
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local iteratee
                        ) : lineInventory.map((inv: any, idx: number) => (
                            <tr key={`${line.salesOrderLineId}-${inv.locationId}`}>
                                {idx === 0 && (
                                    <>
                                        <td rowSpan={lineInventory.length} className="text-[var(--text-muted)]">{line.lineNumber}</td>
                                        <td rowSpan={lineInventory.length} className="font-semibold text-xs">
                                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                                <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline">
                                                    {line.productNumber}
                                                </Link>
                                            ) : (
                                                line.productNumber || '—'
                                            )}
                                        </td>
                                        <td rowSpan={lineInventory.length} className="text-xs">{line.productDescription}</td>
                                        <td rowSpan={lineInventory.length} className="text-right tabular-nums font-semibold">{parseFloat(line.quantity || '0')}</td>
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
                                                if (gap && totalAvail >= gap.orderedQuantity) {
                                                    return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.others')}</span>;
                                                }
                                                return <span className="text-rose-600 font-medium">{tSales('availabilityStatus.shortage')}</span>;
                                            })()}
                                        </td>
                                    </>
                                )}
                                <td className="text-right text-xs">
                                    <Link
                                        href={`/products/${line.productId}?tab=inventory`}
                                        className={`no-underline ${inv.locationId === (editFulfillmentLocationId || order.fulfillmentLocationId) ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)] font-normal'}`}
                                    >
                                        {inv.locationName}
                                    </Link>
                                </td>
                                <td className={`text-right tabular-nums font-semibold ${parseFloat(inv.quantityAvailable || '0') > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--danger)]'}`}>
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
                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{line.lineNumber}</div>
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
                                    <span className="text-sm font-semibold">{parseFloat(line.quantity || '0')}</span>
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
                                            if (gap && totalAvail >= gap.orderedQuantity) return <span className="text-amber-600 font-medium">{tSales('availabilityStatus.others')}</span>;
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
    );
}
