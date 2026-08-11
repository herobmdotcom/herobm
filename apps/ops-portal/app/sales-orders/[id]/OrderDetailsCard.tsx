'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import Link from 'next/link';
import type { OrderDetail } from './types';
import { SALES_ORDER_STATE, DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface OrderDetailsCardProps {
    order: OrderDetail;
    isOrderDetailsEditable: boolean;
    editName: string;
    setEditName: (val: string) => void;
    editPO: string;
    setEditPO: (val: string) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    editAnalysisCode: string;
    setEditAnalysisCode: (val: string) => void;
    saveHeader: (overrides?: Partial<api.UpdateOrderDto>) => void;
    onEmailDocumentClick: (hookSlug: string, title: string, prefix: string, docName: string, targetId: string, contextSlug: string) => void;
    reportError: (err: unknown, context: string) => void;
    setError: (err: string) => void;
}

export default function OrderDetailsCard({
    order,
    isOrderDetailsEditable,
    editName,
    setEditName,
    editPO,
    setEditPO,
    editNotes,
    setEditNotes,
    editAnalysisCode,
    setEditAnalysisCode,
    saveHeader,
    onEmailDocumentClick,
    reportError,
    setError
}: OrderDetailsCardProps) {
    const tSales = useTranslations('salesOrders');
    const tCommon = useTranslations('common');

    return (
        <div id="details-section" className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="section-heading mb-0">
                    <span className="material-symbols-outlined">
                        receipt_long
                    </span>
                    {tSales('orderDetails')}
                </h3>
                <div className="flex items-center gap-2">
                    {(order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED) && (
                        <Button
                            variant="secondary" size="sm"
                            onClick={() => onEmailDocumentClick('sales-order-quote', 'Email Quote', 'Quote', 'Quote', order.salesOrderId!, DATA_SOURCE_CONTEXT.SALES_ORDER)}
                        >
                            <span className="material-symbols-outlined text-base">mail</span>
                            Email Quote
                        </Button>
                    )}
                    {order.stateCode !== SALES_ORDER_STATE.DRAFT && (
                        <Button
                            variant="secondary" size="sm"
                            onClick={() => onEmailDocumentClick('sales-order-confirmation', 'Email Confirmation', 'Order Confirmation', 'Confirmation', order.salesOrderId!, DATA_SOURCE_CONTEXT.SALES_ORDER)}
                        >
                            Email Confirmation
                        </Button>
                    )}
                    {order.stateCode !== SALES_ORDER_STATE.DRAFT && order.stateCode !== SALES_ORDER_STATE.QUOTED && (
                        <Button
                            variant="secondary" size="sm" className="flex items-center gap-1"
                            onClick={() => onEmailDocumentClick('pro-forma-invoice', 'Email Pro-Forma Invoice', 'Pro-Forma Invoice', 'Pro-Forma', order.salesOrderId!, DATA_SOURCE_CONTEXT.SALES_ORDER)}
                        >
                            Email Pro-Forma
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.customer')}
                        {order.currencyCode && (
                            <span
                                style={{
                                    marginLeft: 8,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(59,130,246,0.15)',
                                    color: 'var(--accent)',
                                    fontWeight: 600,
                                    fontSize: 10,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                {order.currencyCode}
                            </span>
                        )}
                    </label>
                    <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                        {order.customerName || order.customerId ? (
                            <Link 
                                href={`/customers/${order.customerId}`} 
                                style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                className="hover:underline"
                            >
                                {order.customerName || <span style={{ fontStyle: 'italic' }}>{tSales('unnamedCustomer')}</span>}
                            </Link>
                        ) : (
                            '—'
                        )}
                    </p>
                </div>
                <div className="min-w-0">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.created')}
                    </label>
                    <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                        {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy || '—'}
                    </p>
                </div>
                <div className="min-w-0">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.orderName')}
                    </label>
                    <input
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => saveHeader()}
                        placeholder={tSales('placeholders.orderName')}
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.customerPO')}
                    </label>
                    <input
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editPO}
                        onChange={(e) => setEditPO(e.target.value)}
                        onBlur={() => saveHeader()}
                        placeholder={tSales('placeholders.customerPO')}
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Analysis Code
                    </label>
                    <input
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editAnalysisCode}
                        onChange={(e) => setEditAnalysisCode(e.target.value)}
                        onBlur={() => saveHeader()}
                        placeholder="e.g. Q3_PROMO"
                    />
                </div>

                <div className="min-w-0 col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tCommon('notesCardHeading')}
                    </label>
                    <input
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        onBlur={() => saveHeader()}
                        placeholder={tCommon('notesCardPlaceholder')}
                    />
                </div>
            </div>
        </div>
    );
}
