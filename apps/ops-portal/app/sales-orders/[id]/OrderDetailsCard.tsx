'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { SALES_ORDER_STATE } from '@modbm/shared';
import { formatLocationDisplay } from '@/lib/formatters';

interface OrderDetailsCardProps {
    order: any;
    isOrderDetailsEditable: boolean;
    editName: string;
    setEditName: (val: string) => void;
    editPO: string;
    setEditPO: (val: string) => void;
    editFulfillmentLocationId: string;
    setEditFulfillmentLocationId: (val: string) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    saveHeader: () => void;
    locations: any[];
    copyOrder: () => void;
    copying: boolean;
    onQuoteClick: () => void;
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
    copyOrder,
    copying,
    onQuoteClick,
    reportError,
    setError
}: OrderDetailsCardProps) {
    const tSales = useTranslations('salesOrders');
    const tCommon = useTranslations('common');
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="section-heading mb-0">
                    <span className="material-symbols-outlined">receipt_long</span>
                    {tSales('orderDetails')}
                </h2>
                <div className="relative">
                    <button
                        className="btn btn-secondary btn-sm px-2"
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                            <div 
                                className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg p-1 z-50 min-w-[150px] flex flex-col gap-1"
                                onClick={() => setMenuOpen(false)}
                            >
                                {(order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED) && (
                                    <button
                                        className="text-sm px-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-md w-full transition-colors"
                                        onClick={onQuoteClick}
                                    >
                                        {tSales('buttons.createQuote')}
                                    </button>
                                )}
                                {(order.stateCode !== SALES_ORDER_STATE.DRAFT && order.stateCode !== SALES_ORDER_STATE.QUOTED) && (
                                    <button
                                        className="text-sm px-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-md w-full transition-colors"
                                        onClick={async () => {
                                            try {
                                                const { apiFetchBlob } = await import('@/lib/api');
                                                const blob = await apiFetchBlob(`/api/reports/hooks/sales-order-confirmation/run?id=${order.id}&context=sales-order`, { method: 'POST' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            } catch (err) {
                                                reportError(err, 'OrderDetailPage:generateConfirmation');
                                                setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                            }
                                        }}
                                    >
                                        {tSales('buttons.confirmationPdf')}
                                    </button>
                                )}
                                {(order.stateCode === SALES_ORDER_STATE.CONFIRMED || order.stateCode === SALES_ORDER_STATE.PICKING) && (
                                    <button
                                        className="text-sm px-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-md w-full transition-colors"
                                        onClick={async () => {
                                            try {
                                                const { apiFetchBlob } = await import('@/lib/api');
                                                const blob = await apiFetchBlob(`/api/reports/hooks/pro-forma-invoice/run?id=${order.id}&context=sales-order`, { method: 'POST' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            } catch (err) {
                                                reportError(err, 'OrderDetailPage:generateProForma');
                                                setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                            }
                                        }}
                                    >
                                        {tSales('buttons.proFormaInvoice')}
                                    </button>
                                )}
                                <button
                                    className="text-sm px-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-md w-full transition-colors"
                                    onClick={copyOrder}
                                    disabled={copying}
                                >
                                    {copying ? tCommon('copying') : tSales('buttons.copyOrder')}
                                </button>
                            </div>
                        </>
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
                        onBlur={saveHeader}
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
                        onBlur={saveHeader}
                        placeholder={tSales('placeholders.customerPO')}
                    />
                </div>
                <div className="min-w-0 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {tSales('labels.fulfillmentLocation')}
                    </label>
                    <select
                        className="input w-full"
                        disabled={!isOrderDetailsEditable}
                        value={editFulfillmentLocationId}
                        onChange={(e) => setEditFulfillmentLocationId(e.target.value)}
                        onBlur={saveHeader}
                    >
                        {locations.map((loc: { locationId: string; name: string; code?: string }) => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {formatLocationDisplay(loc)}
                            </option>
                        ))}
                    </select>
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
                        onBlur={saveHeader}
                        placeholder={tCommon('notesCardPlaceholder')}
                    />
                </div>
            </div>
        </div>
    );
}
