'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import Link from 'next/link';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';

import type { OrderDetail, TaxCategory } from './types';
import { computeLinePrice, PURCHASE_ORDER_STATE, getErrorMessage } from '@herobm/shared';
import { PurchaseInvoice } from '@/lib/purchase-order-utils';
import { useSettings } from '@/components/SettingsProvider';
import { useAuth } from '@/components/AuthGate';
import { useRouter } from 'next/navigation';

interface InvoicesSectionProps {
    orderId: string;
    order: OrderDetail;

    Invoices: PurchaseInvoice[];
    taxCategories: TaxCategory[];
    setError: (msg: string) => void;
    loadInvoices: () => Promise<void>;
    loadOrder: (autoTransitions?: { ruleName: string; from: string; to: string; reason: string; }[], showSpinner?: boolean) => Promise<void>;
}

export default function InvoicesSection({
    orderId, order, Invoices, taxCategories,
    setError, loadInvoices, loadOrder,
}: InvoicesSectionProps) {
  const { baseCurrency } = useSettings();
    const router = useRouter();
    const tCommon = useTranslations('common');
    const tPurchase = useTranslations('purchaseOrders');
    const { permissions } = useAuth();
    const canManageImport = permissions.some(p => p.resource === 'import' && p.action === 'write');

    const [receiptLines, setReceiptLines] = useState<unknown[]>([]);

    useEffect(() => {
        if (orderId) {
            api.goodsReceivedControllerFindAllLines({ purchaseOrderId: orderId } as unknown as Parameters<typeof api.goodsReceivedControllerFindAllLines>[0])
                .then(res => setReceiptLines((res.data )?.data || []))
                .catch(err => reportError(err, 'InvoicesSection'));
        }
    }, [orderId]);

    // Calculate total received across the entire PO to see if generating a Invoice is even possible
    const totalReceived = order.lines.reduce((sum, line) => sum + parseFloat(line.quantityReceived || '0'), 0);

    return (
        <div id="Invoices-section" className="card">
            <div className="flex items-center justify-between mb-2">
                <h3 className="section-heading">
                    { }
                    <span className="material-symbols-outlined">request_quote</span>
                    Supplier Invoices
                </h3>
                {!([PURCHASE_ORDER_STATE.DRAFT, PURCHASE_ORDER_STATE.CANCELLED, PURCHASE_ORDER_STATE.ARCHIVED, PURCHASE_ORDER_STATE.CLOSED_SHORT, PURCHASE_ORDER_STATE.INVOICED] as string[]).includes(order.stateCode ) && (
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={totalReceived === 0 && order.stateCode !== PURCHASE_ORDER_STATE.ORDERED}
                        onClick={() => router.push(`/supplier-invoices/new?purchaseOrderId=${orderId}`)}
                    >
                        {tPurchase('buttons.enterSupplierBill')}
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {Invoices.map(inv => (
                    <div key={inv.invoiceId} style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card, #fff)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col gap-1">
                                <strong style={{ fontSize: 13 }}>{inv.invoiceNumber}</strong>
                                {(inv as unknown as Record<string, string>).supplierInvoiceNumber && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPurchase('ref')} {(inv as unknown as Record<string, string>).supplierInvoiceNumber}</span>
                                )}
                                {(inv as unknown as Record<string, string>).receiptFilename && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPurchase('file')} {(inv as unknown as Record<string, string>).receiptFilename}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
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

                            const columns: DataTableColumn<typeof linePricing[0]>[] = [
                                {
                                    id: 'product',
                                    header: tPurchase('columns.product'),
                                    render: ({ il, orderLine }) => (
                                        <span style={{ fontWeight: 600, fontSize: 12 }}>
                                            {orderLine?.productNumber || il.productNumber || il.productId?.substring(0, 8) || '—'}
                                        </span>
                                    )
                                },
                                {
                                    id: 'description',
                                    header: tPurchase('columns.description'),
                                    render: ({ il, orderLine }) => (
                                        <>
                                            <div>{il.description || '—'}</div>
                                            {!orderLine && il.purchaseOrderNumber && (
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {tPurchase('supplierInvoice.fromPo')}: <Link href={`/purchase-orders/${il.purchaseOrderId}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{il.purchaseOrderNumber}</Link>
                                                </div>
                                            )}
                                            {!orderLine && !il.purchaseOrderNumber && (
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {tPurchase('supplierInvoice.standaloneItem')}
                                                </div>
                                            )}
                                        </>
                                    )
                                },
                                {
                                    id: 'qty',
                                    header: tPurchase('columns.qty'),
                                    align: 'right',
                                    render: ({ il }) => il.quantityInvoiced
                                },
                                {
                                    id: 'unitPrice',
                                    header: tPurchase('columns.unitPrice'),
                                    align: 'right',
                                    render: ({ il, orderLine }) => (
                                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatAmount(parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'), cc)}
                                        </span>
                                    )
                                },
                                {
                                    id: 'discountPct',
                                    header: tPurchase('columns.discountPct'),
                                    align: 'right',
                                    render: ({ disc }) => (
                                        <span style={{ color: disc > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                            {disc.toFixed(1)}%
                                        </span>
                                    )
                                },
                                {
                                    id: 'tax',
                                    header: tPurchase('columns.tax'),
                                    align: 'right',
                                    render: ({ taxRate }) => (
                                        <span style={{ color: taxRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                            {taxRate.toFixed(1)}%
                                        </span>
                                    )
                                },
                                {
                                    id: 'receipt',
                                    header: tPurchase('supplierInvoice.receipt'),
                                    render: ({ il }) => (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {il.goodsReceivedLineId ? (
                                                receiptLines.find(r => (r as unknown as Record<string, Record<string, string>>).line?.goodsReceivedLineId === il.goodsReceivedLineId) ? (receiptLines.find(r => (r as unknown as Record<string, Record<string, string>>).line?.goodsReceivedLineId === il.goodsReceivedLineId) as Record<string, string>).receiptNumber : 'Receipt'
                                            ) : '—'}
                                        </span>
                                    )
                                },
                                {
                                    id: 'amount',
                                    header: tPurchase('columns.amount'),
                                    align: 'right',
                                    render: ({ pricing }) => (
                                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {formatAmount(pricing.amount, cc)}
                                        </span>
                                    )
                                }
                            ];

                            return (
                                <div className="mt-2">
                                    <DataTable
                                        columns={columns}
                                        data={linePricing}
                                        keyExtractor={(item) => item.il.invoiceLineId || (item.il as unknown as Record<string, string>).lineId || item.il.purchaseOrderLineId}
                                        mobileCard={({ il, orderLine, disc, taxRate, pricing }) => (
                                            <MobileLineItemCard
                                                title={orderLine?.productNumber || il.productNumber || il.productId?.substring(0, 8) || '—'}
                                                subtitle={il.description || '—'}
                                                details={[
                                                    { label: tPurchase('columns.qty'), value: il.quantityInvoiced },
                                                    { label: tPurchase('columns.unitPrice'), value: formatAmount(parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'), cc) },
                                                    { label: tPurchase('columns.discountPct'), value: `${disc.toFixed(1)}%` },
                                                    { label: tPurchase('columns.tax'), value: `${taxRate.toFixed(1)}%` },
                                                    { label: tPurchase('columns.amount'), value: formatAmount(pricing.amount, cc), isHighlighted: true }
                                                ]}
                                            />
                                        )}
                                    />
                                    
                                    <div className="mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
                                        <table className="w-full text-sm">
                                            <tbody>
                                                <tr>
                                                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                                                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
                                                        {formatAmount(subtotal, cc)}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                                                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
                                                        {formatAmount(effectiveTaxTotal, cc)}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                                                    <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">
                                                        {formatAmount(grandTotal, cc)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
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
