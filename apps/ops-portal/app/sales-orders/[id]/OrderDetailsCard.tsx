'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import Link from 'next/link';
import type { OrderDetail } from './types';
import { SALES_ORDER_STATE } from '@herobm/shared';
import { formatLocationDisplay } from '@/lib/formatters';
interface OrderDetailsCardProps {
    order: OrderDetail;
    isOrderDetailsEditable: boolean;
    editName: string;
    setEditName: (val: string) => void;
    editPO: string;
    setEditPO: (val: string) => void;
    editFulfillmentLocationId: string;
    setEditFulfillmentLocationId: (val: string) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    saveHeader: (overrides?: Partial<api.UpdateOrderDto>) => void;
    locations: api.InventoryLocationResponseDto[];
    customerDeliveryAddresses: api.DeliveryAddressResponseDto[];
    customerCountry?: string;
    editShippingNotes: string;
    setEditShippingNotes: (val: string) => void;
    editDeliveryCompanyName: string;
    setEditDeliveryCompanyName: (val: string) => void;
    editDeliveryName: string;
    setEditDeliveryName: (val: string) => void;
    editDeliveryPhone: string;
    setEditDeliveryPhone: (val: string) => void;
    editDeliveryAddressLine1: string;
    setEditDeliveryAddressLine1: (val: string) => void;
    editDeliveryAddressLine2: string;
    setEditDeliveryAddressLine2: (val: string) => void;
    editDeliveryCity: string;
    setEditDeliveryCity: (val: string) => void;
    editDeliveryState: string;
    setEditDeliveryState: (val: string) => void;
    editDeliveryPostalCode: string;
    setEditDeliveryPostalCode: (val: string) => void;
    editDeliveryCountry: string;
    setEditDeliveryCountry: (val: string) => void;
    onEmailDocumentClick: (hookSlug: string, title: string, prefix: string, docName: string) => void;
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
    editFulfillmentLocationId,
    setEditFulfillmentLocationId,
    editNotes,
    setEditNotes,
    saveHeader,
    locations,
    customerDeliveryAddresses,
    customerCountry,
    editShippingNotes,
    setEditShippingNotes,
    editDeliveryCompanyName,
    setEditDeliveryCompanyName,
    editDeliveryName,
    setEditDeliveryName,
    editDeliveryPhone,
    setEditDeliveryPhone,
    editDeliveryAddressLine1,
    setEditDeliveryAddressLine1,
    editDeliveryAddressLine2,
    setEditDeliveryAddressLine2,
    editDeliveryCity,
    setEditDeliveryCity,
    editDeliveryState,
    setEditDeliveryState,
    editDeliveryPostalCode,
    setEditDeliveryPostalCode,
    editDeliveryCountry,
    setEditDeliveryCountry,
    onEmailDocumentClick,
    reportError,
    setError
}: OrderDetailsCardProps) {
    const tSales = useTranslations('salesOrders');
    const tCommon = useTranslations('common');
    return (
        <div className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="section-heading mb-0">
                    { }
                    <span className="material-symbols-outlined">
                        receipt_long
                    </span>
                    {tSales('orderDetails')}
                </h2>
                <div className="flex items-center gap-2">
                    {(order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED) && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onEmailDocumentClick('sales-order-quote', 'Email Quote', 'Quote', 'Quote')}
                        >
                            Email Quote
                        </button>
                    )}
                    {(order.stateCode !== SALES_ORDER_STATE.DRAFT && order.stateCode !== SALES_ORDER_STATE.QUOTED) && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onEmailDocumentClick('sales-order-confirmation', 'Email Confirmation', 'Order Confirmation', 'Confirmation')}
                        >
                            Email Confirmation
                        </button>
                    )}
                    {(order.stateCode === SALES_ORDER_STATE.CONFIRMED || order.stateCode === SALES_ORDER_STATE.PICKING) && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onEmailDocumentClick('pro-forma-invoice', 'Email Pro-Forma Invoice', 'Pro-Forma Invoice', 'Pro-Forma')}
                        >
                            Email Pro-Forma
                        </button>
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
