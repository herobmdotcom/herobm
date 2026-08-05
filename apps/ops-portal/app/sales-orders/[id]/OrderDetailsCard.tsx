'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import Link from 'next/link';
import type { OrderDetail } from './types';
import { SALES_ORDER_STATE, DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { formatLocationDisplay } from '@/lib/formatters';
import { Button } from '@/components/shared/Button';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const parseInitialPhone = (val: string) => {
    if (!val) return '';
    if (val.startsWith('+')) return val;
    const digits = val.replace(/\D/g, '');
    if (digits.length > 0) return '+' + digits;
    return '';
};

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
    editAnalysisCode: string;
    setEditAnalysisCode: (val: string) => void;
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
    onAddAddress: () => void;
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
    editFulfillmentLocationId,
    setEditFulfillmentLocationId,
    editNotes,
    setEditNotes,
    editAnalysisCode,
    setEditAnalysisCode,
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
    onAddAddress,
    onEmailDocumentClick,
    reportError,
    setError
}: OrderDetailsCardProps) {
    const tSales = useTranslations('salesOrders');
    const tCommon = useTranslations('common');
    
    const selectedAddressId = customerDeliveryAddresses.find(a => a.addressLine1 === editDeliveryAddressLine1 && a.city === editDeliveryCity)?.deliveryAddressId || (editDeliveryAddressLine1 ? 'other' : '');

    return (
        <div id="details-section" className="card">
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

            <hr className="my-6 border-t border-[var(--border)]" />

            <h3 className="section-heading mb-4">

                <span className="material-symbols-outlined">local_shipping</span>
                Delivery
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="flex flex-col gap-4">
                    <div className="mt-2">

                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Delivery Address
                        </label>
                        <select
                            className="input w-full mb-2"
                            disabled={!isOrderDetailsEditable}
                            value={selectedAddressId}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'other') {
                                    onAddAddress();
                                } else {
                                    const addr = customerDeliveryAddresses.find(a => a.deliveryAddressId === val);
                                    if (addr) {
                                        setEditDeliveryCompanyName(addr.companyName || '');
                                        setEditDeliveryName(addr.recipientName || '');
                                        setEditDeliveryPhone(addr.recipientPhone || '');
                                        setEditDeliveryAddressLine1(addr.addressLine1 || '');
                                        setEditDeliveryAddressLine2(addr.addressLine2 || '');
                                        setEditDeliveryCity(addr.city || '');
                                        setEditDeliveryState(addr.stateOrProvince || '');
                                        setEditDeliveryPostalCode(addr.postalCode || '');
                                        setEditDeliveryCountry(addr.country || '');
                                        saveHeader({
                                            deliveryCompanyName: addr.companyName || undefined,
                                            deliveryName: addr.recipientName || undefined,
                                            deliveryPhone: addr.recipientPhone || undefined,
                                            deliveryAddressLine1: addr.addressLine1 || undefined,
                                            deliveryAddressLine2: addr.addressLine2 || undefined,
                                            deliveryCity: addr.city || undefined,
                                            deliveryState: addr.stateOrProvince || undefined,
                                            deliveryPostalCode: addr.postalCode || undefined,
                                            deliveryCountry: addr.country || undefined,
                                        });
                                    }
                                }
                            }}
                        >
                            <option value="" disabled>Select an address...</option>
                            {customerDeliveryAddresses.map(addr => (
                                <option key={addr.deliveryAddressId} value={addr.deliveryAddressId}>
                                    {addr.addressName ? `${addr.addressName} - ` : ''}{addr.addressLine1}, {addr.city}
                                </option>
                            ))}
                            <option value="other">Other...</option>
                        </select>
                        <div className="grid grid-cols-2 gap-4 mb-2 mt-2">
                            <input
                                className="input w-full"
                                disabled={!isOrderDetailsEditable}
                                placeholder="Attention To"
                                value={editDeliveryName}
                                onChange={(e) => setEditDeliveryName(e.target.value)}
                                onBlur={() => saveHeader()}
                            />
                            <div>
                                <PhoneInput
                                    international
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required because defaultCountry requires a specific enum type
                                    defaultCountry={customerCountry as any}
                                    disabled={!isOrderDetailsEditable}
                                    className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
                                    value={parseInitialPhone(editDeliveryPhone)}
                                    onChange={(value) => setEditDeliveryPhone(value || '')}
                                    onBlur={() => saveHeader()}
                                    placeholder="Phone"
                                />
                                {editDeliveryPhone && !editDeliveryPhone.startsWith('+') && (
                                    <p className="text-xs text-orange-500 mt-1">{tCommon('rawPhone', { phone: editDeliveryPhone })}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2">

                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Shipping Instructions
                        </label>
                        <textarea
                            id="shipping-notes"
                            className="input w-full"
                            disabled={!isOrderDetailsEditable}
                            style={{ minHeight: 80, paddingTop: 12, resize: 'vertical' }}
                            placeholder="Add shipping instructions..."
                            value={editShippingNotes}
                            onChange={(e) => setEditShippingNotes(e.target.value)}
                            onBlur={() => saveHeader()}
                        />
                    </div>
                </div>

                <div className="mt-2">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.fulfillmentLocation')}
                    </label>
                    <select
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editFulfillmentLocationId}
                        onChange={(e) => setEditFulfillmentLocationId(e.target.value)}
                        onBlur={() => saveHeader()}
                    >
                        {locations.length === 0 && <option value="" disabled>{tCommon('loadingEllipsis')}</option>}
                        {locations.map((loc) => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {formatLocationDisplay(loc)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

        </div>
    );
}
