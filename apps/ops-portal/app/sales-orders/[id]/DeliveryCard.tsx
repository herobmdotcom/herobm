'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatLocationDisplay } from '@/lib/formatters';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const parseInitialPhone = (val: string) => {
    if (!val) return '';
    if (val.startsWith('+')) return val;
    const digits = val.replace(/\D/g, '');
    if (digits.length > 0) return '+' + digits;
    return '';
};

interface DeliveryCardProps {
    isOrderDetailsEditable: boolean;
    locations: api.InventoryLocationResponseDto[];
    customerDeliveryAddresses: api.DeliveryAddressResponseDto[];
    customerCountry?: string;
    editFulfillmentLocationId: string;
    setEditFulfillmentLocationId: (val: string) => void;
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
    saveHeader: (overrides?: Partial<api.UpdateOrderDto>) => void;
}

export default function DeliveryCard({
    isOrderDetailsEditable,
    locations,
    customerDeliveryAddresses,
    customerCountry,
    editFulfillmentLocationId,
    setEditFulfillmentLocationId,
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
    saveHeader,
}: DeliveryCardProps) {
    const tSales = useTranslations('salesOrders');
    const tCommon = useTranslations('common');

    const selectedAddressId = customerDeliveryAddresses.find(a => a.addressLine1 === editDeliveryAddressLine1 && a.city === editDeliveryCity)?.deliveryAddressId || (editDeliveryAddressLine1 ? 'other' : '');

    return (
        <div id="delivery-section" className="card">
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
