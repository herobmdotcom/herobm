'use client';

import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { formatLocalDate } from '@/lib/date';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';
import type { OrderDetail } from '../types';

interface OrderBackordersTabProps {
    order: OrderDetail;
}

export function OrderBackordersTab({ order }: OrderBackordersTabProps) {
    const tSales = useTranslations('salesOrders');

    return (
        <div>
            <DataTable
                data={order.backorders || []}
                keyExtractor={(bo, idx) => bo.salesOrderLineId || bo.purchaseOrderId || idx}
                emptyMessage={tSales('noBackordersFound')}
                columns={[
                    { header: tSales('columns.lineNumber'), width: 48, align: 'center' },
                    { header: tSales('columns.product') },
                    { header: tSales('columns.allocatedTo') },
                    { header: tSales('columns.soStatus') },
                    { header: tSales('columns.poStatus') },
                    { header: tSales('columns.demandDate') },
                ]}
                renderCustomRow={(bo, bo_idx) => {
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
                                <div className="text-[11px] text-[var(--text-muted)]">{tSales('demandedQty', { qty: bo.quantity || '0' })}</div>
                            </td>
                            <td>
                                {isAllocated ? (
                                    <Link 
                                        href={isPo ? routes.purchaseOrders.detail(bo.purchaseOrderId!) : routes.inventory.transfers.detail(bo.transferOrderId!)}
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
                                    <StateBadge state={((isPo ? bo.purchaseOrderState : bo.transferOrderState) || 'DRAFT') as ValidState} />
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </td>
                            <td>{formatLocalDate(bo.createdOn)}</td>
                        </tr>
                    );
                }}
                mobileCard={(bo) => {
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
                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{bo.lineNumber || '—'}</div>
                            </div>
                            
                            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1 mt-2">
                                <MobileCardField label={tSales('columns.allocatedTo')} value={
                                    isAllocated ? (
                                        <Link 
                                            href={isPo ? routes.purchaseOrders.detail(bo.purchaseOrderId!) : routes.inventory.transfers.detail(bo.transferOrderId!)}
                                            className="text-[var(--accent)] font-medium hover:underline"
                                        >
                                            {displayOrderNumber}
                                        </Link>
                                    ) : (
                                        <span className="text-slate-400">{displayOrderNumber}</span>
                                    )
                                } />
                                <MobileCardField label={tSales('columns.demandDate')} value={
                                    formatLocalDate(bo.createdOn)
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
                                        <StateBadge state={((isPo ? bo.purchaseOrderState : bo.transferOrderState) || 'DRAFT') as ValidState} />
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
    );
}
