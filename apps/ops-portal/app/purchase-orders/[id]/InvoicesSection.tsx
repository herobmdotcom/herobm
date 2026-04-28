'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiMutate, apiFetch, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';

import type { OrderDetail, TaxCategory } from './types';
import { computeLinePrice } from '@modbm/shared';
import { PurchaseInvoice } from '@/lib/purchase-order-utils';
import { useSettings } from '@/components/SettingsProvider';
import { useRouter } from 'next/navigation';

interface InvoicesSectionProps {
    orderId: string;
    order: OrderDetail;

    Invoices: PurchaseInvoice[];
    taxCategories: TaxCategory[];
    setError: (msg: string) => void;
    loadInvoices: () => Promise<void>;
    loadOrder: (autoTransitions?: any[], showSpinner?: boolean) => Promise<void>;
}

export default function InvoicesSection({
    orderId, order, Invoices, taxCategories,
    setError, loadInvoices, loadOrder,
}: InvoicesSectionProps) {
  const { baseCurrency } = useSettings();
    const router = useRouter();
    const tCommon = useTranslations('common');
    const tPurchase = useTranslations('purchaseOrders');

    const [receiptLines, setReceiptLines] = useState<any[]>([]);

    useEffect(() => {
        if (orderId) {
            apiFetch<{ data: any[] }>(`/api/goods-received/lines?purchaseOrderId=${orderId}`)
                .then(res => setReceiptLines(res.data || []))
                .catch(err => reportError(err, 'InvoicesSection'));
        }
    }, [orderId]);

    // Calculate total received across the entire PO to see if generating a Invoice is even possible
    const totalReceived = order.lines.reduce((sum, line) => sum + parseFloat(line.quantityReceived || '0'), 0);

    return (
        <div id="Invoices-section" className="card">
            <div className="flex items-center justify-between mb-2">
                <h3 className="section-heading">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined">request_quote</span>
                    Supplier Invoices
                </h3>
                {['received', 'partially_received', 'legacy'].includes(order.stateCode) && (
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={totalReceived === 0}
                        onClick={() => router.push(`/purchase-invoices/new?purchaseOrderId=${orderId}`)}
                    >
                        {tPurchase('buttons.enterSupplierBill')}
                    </button>
                )}
            </div>

            <div style={{ marginBottom: 24, marginTop: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>{tPurchase('billSummary')}</h4>
                <table className="table-lines">
                    <thead>
                        <tr>
                            <th>{tPurchase('columns.product')}</th>
                            <th>{tPurchase('columns.description')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.received')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.billed')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.remaining')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(order.lines || []).map(line => {
                            const ordered = parseFloat(line.quantity || '0');
                            const received = parseFloat(line.quantityReceived || '0');
                            const billed = Invoices.reduce((sum, inv) => {
                                const invLine = inv.lines?.find(il => il.purchaseOrderLineId === line.purchaseOrderLineId);
                                return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                            }, 0);
                            const remaining = Math.max(0, ordered - billed);
                            return (
                                <tr key={line.purchaseOrderLineId}>
                                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                    </td>
                                    <td>{line.productDescription || '—'}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ordered}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: received >= ordered && ordered > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: received >= ordered && ordered > 0 ? 600 : 400 }}>{received}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: billed >= received && received > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: billed >= received && received > 0 ? 600 : 400 }}>{billed}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: remaining === 0 ? 'var(--text-muted)' : undefined }}>{remaining}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>



            <div className="space-y-3">
                {Invoices.map(inv => (
                    <div key={inv.invoiceId} style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card, #fff)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col gap-1">
                                <strong style={{ fontSize: 13 }}>{inv.invoiceNumber}</strong>
                                {(inv as any).supplierinvoiceNumber && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPurchase('ref')} {(inv as any).supplierinvoiceNumber}</span>
                                )}
                                {(inv as any).receiptFilename && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPurchase('file')} {(inv as any).receiptFilename}</span>
                                )}
                            </div>
                        </div>
                        
                        {inv.lines && inv.lines.length > 0 && (() => {
                            const cc = order.currencyCode || baseCurrency;
                            const sortedLines = [...inv.lines].sort((a, b) => {
                                const aIdx = order.lines.findIndex((ol) => ol.purchaseOrderLineId === a.purchaseOrderLineId);
                                const bIdx = order.lines.findIndex((ol) => ol.purchaseOrderLineId === b.purchaseOrderLineId);
                                return aIdx - bIdx;
                            });

                            // Centralised pricing — compute per-line then sum
                            let subtotal = 0;
                            let calculatedTaxTotal = 0;
                            const linePricing = sortedLines.map((il) => {
                                const orderLine = order.lines.find(ol => ol.purchaseOrderLineId === il.purchaseOrderLineId);
                                const disc = parseFloat(orderLine?.discountPercentage || '0');
                                const taxCat = taxCategories.find(c => c.taxCategoryId === orderLine?.taxCategoryId);
                                const taxRate = parseFloat(taxCat?.rate || '0');
                                const pricing = computeLinePrice({
                                    quantity: parseFloat(il.quantityInvoiced),
                                    pricePerUnit: parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'),
                                    discountPercentage: disc,
                                    taxRate: taxRate,
                                });
                                subtotal += pricing.amount;
                                calculatedTaxTotal += pricing.tax;
                                return { il, orderLine, disc, taxRate, pricing };
                            });
                            
                            // Prefer the explicit DB taxAmount to handle imported legacy Invoices safely
                            const dbTaxAmount = inv.taxAmount != null ? parseFloat(inv.taxAmount as string) : 0;
                            const effectiveTaxTotal = dbTaxAmount !== 0 ? dbTaxAmount : calculatedTaxTotal;
                            const grandTotal = subtotal + effectiveTaxTotal;

                            return (
                                <table className="table-lines">
                                    <thead>
                                        <tr>
                                            <th>{tPurchase('columns.product')}</th>
                                            <th>{tPurchase('columns.description')}</th>
                                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.qty')}</th>
                                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
                                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.discountPct')}</th>
                                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.tax')}</th>
                                            <th>Receipt</th>
                                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linePricing.map(({ il, orderLine, disc, taxRate, pricing }) => (
                                                <tr key={il.invoiceLineId || (il as any).lineId || il.purchaseOrderLineId}>
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
                                                    <td style={{ textAlign: 'right', color: taxRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                        {taxRate.toFixed(1)}%
                                                    </td>
                                                    <td style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                        {il.goodsReceivedLineId ? (
                                                            receiptLines.find(r => r.line.goodsReceivedLineId === il.goodsReceivedLineId)?.receiptNumber || 'Receipt'
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                        {formatAmount(pricing.amount, cc)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '1px solid var(--border)' }}>
                                            <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{tCommon('subtotal')}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(subtotal, cc)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{tCommon('tax')}</td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(effectiveTaxTotal, cc)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{tCommon('total')}</td>
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
                {Invoices.length === 0 && (
                    <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {tPurchase('noBillsGeneratedYet')}
                    </div>
                )}
            </div>
        </div>
    );
}
