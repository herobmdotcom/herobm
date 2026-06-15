'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';

import type { OrderDetail, TaxCategory, SalesInvoice } from './types';
import { computeLinePrice, SALES_ORDER_STATE, SALES_INVOICE_STATE } from '@herobm/shared';
import type { NewInvoiceLine } from './useOrder';
import { calculateInvoiceableQuantities } from '@/lib/sales-order-utils';
import { useSettings } from '@/components/SettingsProvider';

interface InvoicesSectionProps {
    orderId: string;
    order: OrderDetail;

    invoices: SalesInvoice[];
    taxCategories: TaxCategory[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pickingSummary: Record<string, any> | null;
    setError: (msg: string) => void;
    loadInvoices: () => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadOrder: (autoTransitions?: Record<string, any>[], showSpinner?: boolean) => Promise<void>;
}

export default function InvoicesSection({
    orderId, order, invoices, taxCategories,
    pickingSummary, setError, loadInvoices, loadOrder,
}: InvoicesSectionProps) {
  const { baseCurrency } = useSettings();
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
            await api.salesInvoiceControllerCreateSalesInvoice(orderId, {
                notes: newInvoiceNotes || undefined,
                lines: lines.length > 0 ? lines : undefined,
            } );
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
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined">request_quote</span>
                    Invoices
                </h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {['shipped', 'picking'].includes(order.stateCode as any) && !showCreateInvoice && (
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                            {/* eslint-disable-next-line i18next/no-literal-string */}
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
                    <DataTable
                        data={newInvoiceLines}
                        keyExtractor={(nl) => nl.salesOrderLineId}
                        columns={[
                            { header: '#', width: 40 },
                            { header: tSales('columns.product') },
                            { header: tSales('columns.description') },
                            { header: tSales('columns.ordered'), align: 'right' },
                            { header: tSales('columns.picked'), align: 'right' },
                            { header: tSales('columns.shipped'), align: 'right' },
                            { header: tSales('columns.invoiced'), align: 'right' },
                            { header: tSales('columns.qtyToInvoice'), width: 110, align: 'right' }
                        ]}
                        renderCustomRow={(nl, idx) => {
                            const origLine = order.lines.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : 0;
                            const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                            const invoicedQty = invoices.reduce((sum, inv) => {
                                if (inv.stateCode === SALES_INVOICE_STATE.CANCELLED) return sum;
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
                        }}
                        mobileCard={(nl, idx) => {
                            const origLine = order.lines.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === nl.salesOrderLineId);
                            const pickedQty = pLine && pLine.quantityPicked != null ? parseFloat(pLine.quantityPicked) : 0;
                            const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                            const invoicedQty = invoices.reduce((sum, inv) => {
                                if (inv.stateCode === SALES_INVOICE_STATE.CANCELLED) return sum;
                                const invLine = inv.lines?.find(il => il.salesOrderLineId === nl.salesOrderLineId);
                                return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                            }, 0);

                            return (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="font-semibold text-sm text-[var(--accent)]">
                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{origLine?.lineNumber}</div>
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium mb-3">
                                        {origLine?.productDescription || '—'}
                                    </div>
                                    
                                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                        <MobileCardField label={tSales('columns.ordered')} value={
                                            <span className="font-semibold">{origLine?.quantity}</span>
                                        } />
                                        <MobileCardField label={tSales('columns.picked')} value={
                                            <span>{pickedQty}</span>
                                        } />
                                        <MobileCardField label={tSales('columns.shipped')} value={
                                            <span>{shippedQty}</span>
                                        } />
                                        <MobileCardField label={tSales('columns.invoiced')} value={
                                            <span className="text-[var(--text-muted)]">{invoicedQty}</span>
                                        } />
                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-xs font-medium text-slate-500">{tSales('columns.qtyToInvoice')}</span>
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
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />
                    
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
                                <Link href={`/sales-invoices/${inv.invoiceId}`} className="text-[var(--accent)] hover:underline">
                                    <strong style={{ fontSize: 13 }}>{inv.invoiceNumber}</strong>
                                </Link>
                                {inv.stateCode === SALES_INVOICE_STATE.CANCELLED && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">
                                        {tCommon('states.cancelled')}
                                    </span>
                                )}
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                    try {
                                        const response = await api.pdfTemplatesControllerRunHook('sales-invoice', {}, { id: inv.invoiceId, context: 'sales-invoice' });
                                        const blob = response.data ;
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
                            const cc = order.currencyCode || baseCurrency;
                            const sortedLines = [...inv.lines].sort((a, b) => {
                                const aIdx = order.lines.findIndex((ol) => ol.salesOrderLineId === a.salesOrderLineId);
                                const bIdx = order.lines.findIndex((ol) => ol.salesOrderLineId === b.salesOrderLineId);
                                return aIdx - bIdx;
                            });

                            // Centralised pricing — compute per-line then sum
                            let subtotal = 0;
                            let calculatedTaxTotal = 0;
                            const linePricing = sortedLines.map((il) => {
                                const orderLine = order.lines.find(ol => ol.salesOrderLineId === il.salesOrderLineId);
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
                            
                            // Prefer the explicit DB taxAmount to handle imported legacy shipments safely
                            const dbTaxAmount = inv.taxAmount != null ? parseFloat(inv.taxAmount as string) : 0;
                            const effectiveTaxTotal = dbTaxAmount !== 0 ? dbTaxAmount : calculatedTaxTotal;
                            const grandTotal = subtotal + effectiveTaxTotal;

                            return (
                                <DataTable
                                    data={linePricing}
                                    keyExtractor={({ il }, idx) => il.invoiceLineId || idx}
                                    columns={[
                                        { header: tSales('columns.product') },
                                        { header: tSales('columns.description') },
                                        { header: tSales('columns.qty'), align: 'right' },
                                        { header: tSales('columns.unitPrice'), align: 'right' },
                                        { header: tSales('columns.discountPct'), align: 'right' },
                                        { header: tSales('columns.tax'), align: 'right' },
                                        { header: tSales('columns.amount'), align: 'right' }
                                    ]}
                                    renderCustomRow={({ il, orderLine, disc, taxRate, pricing }) => (
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
                                            <td style={{ textAlign: 'right', color: taxRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                {taxRate.toFixed(1)}%
                                            </td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                {formatAmount(pricing.amount, cc)}
                                            </td>
                                        </tr>
                                    )}
                                    mobileCard={({ il, orderLine, disc, taxRate, pricing }) => (
                                        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="font-semibold text-sm text-[var(--accent)]">
                                                    {orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-600 font-medium mb-3">
                                                {orderLine?.productDescription || '—'}
                                            </div>
                                            
                                            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                                <MobileCardField label={tSales('columns.qty')} value={
                                                    <span className="font-semibold">{il.quantityInvoiced}</span>
                                                } />
                                                <MobileCardField label={tSales('columns.unitPrice')} value={
                                                    <span>{formatAmount(parseFloat(il.pricePerUnit || orderLine?.pricePerUnit || '0'), cc)}</span>
                                                } />
                                                {disc > 0 && (
                                                    <MobileCardField label={tSales('columns.discountPct')} value={
                                                        <span>{disc.toFixed(1)}%</span>
                                                    } />
                                                )}
                                                {taxRate > 0 && (
                                                    <MobileCardField label={tSales('columns.tax')} value={
                                                        <span>{taxRate.toFixed(1)}%</span>
                                                    } />
                                                )}
                                                <MobileCardField label={tSales('columns.amount')} value={
                                                    <span className="font-bold text-[var(--accent)] text-base">{formatAmount(pricing.amount, cc)}</span>
                                                } />
                                            </div>
                                        </div>
                                    )}
                                    footer={(
                                        <>
                                            <tr className="hidden lg:table-row" style={{ borderTop: '1px solid var(--border)' }}>
                                                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{tSales('totals.subtotal')}</td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(subtotal, cc)}</td>
                                            </tr>
                                            <tr className="hidden lg:table-row">
                                                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{tSales('totals.tax')}</td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatAmount(effectiveTaxTotal, cc)}</td>
                                            </tr>
                                            <tr className="hidden lg:table-row">
                                                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{tSales('totals.total')}</td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>{formatAmount(grandTotal, cc)}</td>
                                            </tr>
                                            
                                            <tr className="lg:hidden">
                                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('totals.subtotal')}</td>
                                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, cc)}</td>
                                            </tr>
                                            <tr className="lg:hidden">
                                                <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('totals.tax')}</td>
                                                <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(effectiveTaxTotal, cc)}</td>
                                            </tr>
                                            <tr className="lg:hidden">
                                                <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tSales('totals.total')}</td>
                                                <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{formatAmount(grandTotal, cc)}</td>
                                            </tr>
                                        </>
                                    )}
                                />
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
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const totalShipped = pickingSummary?.lines?.reduce((sum: number, pl: any) => sum + parseFloat(pl.quantityShipped || '0'), 0) || 0;
                            if (totalShipped === 0) {
                                return tSales('noProductsShippedYet');
                            }
                            return tSales('noInvoicesGeneratedYet');
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
