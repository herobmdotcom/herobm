'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiMutate } from '@/lib/api';
import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
import { toast } from 'react-hot-toast';

import type { OrderDetail, GstCategory, SalesInvoice } from './types';
import { computeLinePrice } from '@modbm/shared';
import type { NewInvoiceLine } from './useOrder';
import { calculateInvoiceableQuantities } from '@/lib/sales-order-utils';

interface InvoicesSectionProps {
    orderId: string;
    order: OrderDetail;

    invoices: SalesInvoice[];
    gstCategories: GstCategory[];
    pickingSummary: any;
    setError: (msg: string) => void;
    loadInvoices: () => Promise<void>;
    loadOrder: (autoTransitions?: any[], showSpinner?: boolean) => Promise<void>;
}

export default function InvoicesSection({
    orderId, order, invoices, gstCategories,
    pickingSummary, setError, loadInvoices, loadOrder,
}: InvoicesSectionProps) {
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    const tConfirm = useTranslations('confirm');
    const tToast = useTranslations('toast');

    // Local state — only this section needs it
    const [showCreateInvoice, setShowCreateInvoice] = useState(false);
    const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
    const [newInvoiceLines, setNewInvoiceLines] = useState<NewInvoiceLine[]>([]);
    const [invoicing, setInvoicing] = useState(false);

    const handleCreateClick = () => {
        setShowCreateInvoice(true);
        const linesToInvoice = calculateInvoiceableQuantities(
            order.lines, invoices, pickingSummary?.lines,
        ).map(l => ({
            salesOrderLineId: l.salesOrderLineId,
            quantityToInvoice: l.defaultQty,
            maxQuantity: l.maxQty,
        }));
        setNewInvoiceLines(linesToInvoice);
    };

    const handleCancel = () => {
        setShowCreateInvoice(false);
        setNewInvoiceLines([]);
        setNewInvoiceNotes('');
    };

    const handleGenerate = async () => {
        if (!confirm(tConfirm('generateInvoice'))) return;
        setInvoicing(true);
        setError('');
        try {
            const lines = newInvoiceLines
                .filter(l => l.quantityToInvoice && parseFloat(l.quantityToInvoice) > 0)
                .map(l => ({ salesOrderLineId: l.salesOrderLineId, quantityToInvoice: parseFloat(l.quantityToInvoice) }));
            await apiMutate(`/api/sales-orders/${orderId}/invoice`, 'POST', {
                notes: newInvoiceNotes || undefined,
                lines: lines.length > 0 ? lines : undefined,
            });
            toast.success(tToast('invoiceGenerated'));
            handleCancel();
            await loadInvoices();
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateInvoice'));
        } finally {
            setInvoicing(false);
        }
    };

    return (
        <div id="invoices-section" className="card">
            <div className="flex items-center justify-between mb-2">
                <h3 className="section-heading">
                    <span className="material-symbols-outlined">request_quote</span>
                    Invoices
                </h3>
                {['shipped', 'picking'].includes(order.stateCode) && !showCreateInvoice && (
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={(() => {
                            const totalShipped = pickingSummary?.lines?.reduce((sum: number, pl: any) => sum + parseFloat(pl.quantityShipped || '0'), 0) || 0;
                            return totalShipped === 0;
                        })()}
                        onClick={handleCreateClick}
                    >
                        {tSales('buttons.createInvoice')}
                    </button>
                )}
            </div>

            {showCreateInvoice && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-symbols-outlined text-[16px]">request_quote</span>
                            New Invoice
                        </strong>
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
                            onClick={handleCancel}
                        >
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span aria-hidden>✕</span>
                        </button>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <input className="input w-full" placeholder="Invoice Notes (optional)" value={newInvoiceNotes} onChange={e => setNewInvoiceNotes(e.target.value)} />
                    </div>
                    <table className="table-lines" style={{ marginBottom: 12 }}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Ordered</th>
                                <th style={{ textAlign: 'right' }}>Picked</th>
                                <th style={{ textAlign: 'right' }}>Shipped</th>
                                <th style={{ textAlign: 'right' }}>Invoiced</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Qty to Invoice</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newInvoiceLines.map((nl, idx) => {
                                const origLine = order.lines.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                                const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                                const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : 0;
                                const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                                const invoicedQty = invoices.reduce((sum, inv) => {
                                    const invLine = inv.lines?.find(il => il.salesOrderLineId === nl.salesOrderLineId);
                                    return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                                }, 0);

                                return (
                                    <tr key={nl.salesOrderLineId}>
                                        <td style={{ color: 'var(--text-muted)' }}>{origLine?.lineNumber}</td>
                                        <td style={{ fontWeight: 600, fontSize: 12 }}>
                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                        </td>
                                        <td>{origLine?.productDescription || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{origLine?.quantity}</td>
                                        <td style={{ textAlign: 'right' }}>{pickedQty}</td>
                                        <td style={{ textAlign: 'right' }}>{shippedQty}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{invoicedQty}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <input
                                                type="number" className="input" min="0" max={nl.maxQuantity} step="1"
                                                style={{
                                                    width: 70, padding: '2px 6px', borderRadius: 4,
                                                    border: '1px solid var(--border)', background: 'var(--surface)',
                                                    color: 'var(--text)', fontSize: 13, textAlign: 'right',
                                                }}
                                                value={nl.quantityToInvoice}
                                                onChange={e => { const updated = [...newInvoiceLines]; updated[idx].quantityToInvoice = e.target.value; setNewInvoiceLines(updated); }}
                                                placeholder={nl.maxQuantity.toString()}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    <div className="flex items-center gap-2">
                        <button className="btn btn-primary btn-sm" disabled={invoicing || newInvoiceLines.every(l => !l.quantityToInvoice || parseFloat(l.quantityToInvoice) <= 0)} onClick={handleGenerate}>
                            {tSales('buttons.generateInvoice')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                            {tCommon('cancel')}
                        </button>
                    </div>
                </div>
            )}
            <div className="space-y-3">
                {invoices.map(inv => (
                    <div key={inv.invoiceId} style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card, #fff)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <strong style={{ fontSize: 13 }}>{inv.invoiceNumber}</strong>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                    try {
                                        const { apiFetchBlob } = await import('@/lib/api');
                                        const blob = await apiFetchBlob(`/api/reports/hooks/sales-invoice/run?id=${inv.invoiceId}&context=sales-invoice`, { method: 'POST' });
                                        const url = URL.createObjectURL(blob);
                                        window.open(url, '_blank');
                                    } catch (err) {
                                        const { reportError } = await import('@/lib/api');
                                        reportError(err, 'OrderDetailPage:printInvoice');
                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateInvoice'));
                                    }
                                }}
                            >
                                {tSales('buttons.printInvoice')}
                            </button>
                        </div>
                        
                        {inv.lines && inv.lines.length > 0 && (() => {
                            const cc = order.currencyCode || HOME_CURRENCY.code;
                            const sortedLines = [...inv.lines].sort((a, b) => {
                                const aIdx = order.lines.findIndex((ol) => ol.salesOrderLineId === a.salesOrderLineId);
                                const bIdx = order.lines.findIndex((ol) => ol.salesOrderLineId === b.salesOrderLineId);
                                return aIdx - bIdx;
                            });

                            // Centralised pricing — compute per-line then sum
                            let subtotal = 0;
                            let taxTotal = 0;
                            const linePricing = sortedLines.map((il) => {
                                const orderLine = order.lines.find(ol => ol.salesOrderLineId === il.salesOrderLineId);
                                const disc = parseFloat(orderLine?.discountPercentage || '0');
                                const gstCat = gstCategories.find(c => c.gstCategoryId === orderLine?.gstCategoryId);
                                const gstRate = parseFloat(gstCat?.rate || '0');
                                const pricing = computeLinePrice({
                                    quantity: parseFloat(il.quantityInvoiced),
                                    pricePerUnit: parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'),
                                    discountPercentage: disc,
                                    taxRate: gstRate,
                                });
                                subtotal += pricing.amount;
                                taxTotal += pricing.tax;
                                return { il, orderLine, disc, gstRate, pricing };
                            });
                            const grandTotal = subtotal + taxTotal;
                            return (
                                <table className="table-lines">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Description</th>
                                            <th style={{ textAlign: 'right' }}>Qty</th>
                                            <th style={{ textAlign: 'right' }}>Unit Price</th>
                                            <th style={{ textAlign: 'right' }}>Disc %</th>
                                            <th style={{ textAlign: 'right' }}>GST</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linePricing.map(({ il, orderLine, disc, gstRate, pricing }) => (
                                                <tr key={il.lineId || il.invoiceLineId}>
                                                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                                                        {orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                                                    </td>
                                                    <td>{orderLine?.productDescription || '—'}</td>
                                                    <td style={{ textAlign: 'right' }}>{il.quantityInvoiced}</td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatAmount(parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'), cc)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: disc > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                        {disc.toFixed(1)}%
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: gstRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                        {gstRate.toFixed(1)}%
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                        {formatAmount(pricing.amount, cc)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '1px solid var(--border)' }}>
                                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Subtotal</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(subtotal, cc)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Tax</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(taxTotal, cc)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>{formatAmount(grandTotal, cc)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            );
                        })()}

                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            {inv.createdBy
                                ? `Created ${new Date(inv.createdOn).toLocaleDateString()} by ${inv.createdBy}`
                                : `Created ${new Date(inv.createdOn).toLocaleDateString()}`}
                        </div>
                    </div>
                ))}
                {invoices.length === 0 && (
                    <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {(() => {
                            const totalShipped = pickingSummary?.lines?.reduce((sum: number, pl: any) => sum + parseFloat(pl.quantityShipped || '0'), 0) || 0;
                            if (totalShipped === 0) {
                                return "No products have shipped yet.";
                            }
                            return "No invoices generated yet.";
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
