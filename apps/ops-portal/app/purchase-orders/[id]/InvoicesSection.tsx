'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiMutate, apiFetch } from '@/lib/api';
import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
import { toast } from 'react-hot-toast';

import type { OrderDetail, TaxCategory } from './types';
import { computeLinePrice } from '@modbm/shared';
import { calculatePurchaseInvoiceableQuantities, PurchaseInvoice } from '@/lib/purchase-order-utils';

export interface NewPurchaseInvoiceLine {
    purchaseOrderLineId: string;
    quantityToInvoice: string;
    maxQuantity: number;
    goodsReceivedLineId?: string;
}

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
    const tCommon = useTranslations('common');
    const tPurchase = useTranslations('purchaseOrders');
    const tConfirm = useTranslations('confirm');
    const tToast = useTranslations('toast');

    // Local state
    const [showCreateInvoice, setShowCreateInvoice] = useState(false);
    const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
    const [supplierinvoiceNumber, setSupplierinvoiceNumber] = useState('');
    const [receiptFilename, setReceiptFilename] = useState('');
    const [newInvoiceLines, setNewInvoiceLines] = useState<NewPurchaseInvoiceLine[]>([]);
    const [receiptLines, setReceiptLines] = useState<any[]>([]);
    const [invoicing, setInvoicing] = useState(false);

    useEffect(() => {
        if (showCreateInvoice && orderId) {
            loadReceiptLines();
        }
    }, [showCreateInvoice, orderId]);

    const loadReceiptLines = async () => {
        try {
            const res = await apiFetch<{ data: any[] }>(`/api/goods-received/lines?purchaseOrderId=${orderId}`);
            setReceiptLines(res.data || []);
        } catch (err) {
            console.error('Failed to load receipt lines', err);
        }
    };

    const handleCreateClick = () => {
        setShowCreateInvoice(true);
        const linesToInvoice = calculatePurchaseInvoiceableQuantities(
            order.lines, Invoices,
        ).map(l => ({
            purchaseOrderLineId: l.purchaseOrderLineId,
            quantityToInvoice: l.defaultQty,
            maxQuantity: l.maxQty,
        }));
        setNewInvoiceLines(linesToInvoice);
    };

    const handleCancel = () => {
        setShowCreateInvoice(false);
        setNewInvoiceLines([]);
        setNewInvoiceNotes('');
        setSupplierinvoiceNumber('');
        setReceiptFilename('');
    };

    const handleGenerate = async () => {
        if (!confirm(tConfirm('generateSupplierBill'))) return;
        setInvoicing(true);
        setError('');
        try {
            const lines = newInvoiceLines
                .filter(l => l.quantityToInvoice && parseFloat(l.quantityToInvoice) > 0)
                .map(l => ({
                    purchaseOrderLineId: l.purchaseOrderLineId,
                    quantityToInvoice: parseFloat(l.quantityToInvoice),
                    goodsReceivedLineId: l.goodsReceivedLineId || undefined,
                }));
            
            await apiMutate(`/api/purchase-orders/${orderId}/invoice`, 'POST', {
                supplierInvoiceNumber: supplierinvoiceNumber || undefined,
                receiptFilename: receiptFilename || undefined,
                notes: newInvoiceNotes || undefined,
                lines: lines.length > 0 ? lines : undefined,
            });
            toast.success(tToast('supplierBillGenerated'));
            handleCancel();
            await loadInvoices();
            await loadOrder(undefined, false);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : tCommon('errors.failedToGenerateInvoice');
            toast.error(errorMsg);
            setError(errorMsg);
        } finally {
            setInvoicing(false);
        }
    };

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
                {['received', 'partially_received', 'legacy'].includes(order.stateCode) && !showCreateInvoice && (
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={totalReceived === 0}
                        onClick={handleCreateClick}
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

            {showCreateInvoice && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                            Enter Supplier Invoice
                        </strong>
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
                            onClick={handleCancel}
                        >
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span aria-hidden>✕</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
                        <input className="input w-full" placeholder="Supplier Invoice Number *" value={supplierinvoiceNumber} onChange={e => setSupplierinvoiceNumber(e.target.value)} />
                        <input className="input w-full" placeholder="Invoice filename" value={receiptFilename} onChange={e => setReceiptFilename(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <input className="input w-full" placeholder="Notes" value={newInvoiceNotes} onChange={e => setNewInvoiceNotes(e.target.value)} />
                    </div>

                    <table className="table-lines" style={{ marginBottom: 12 }}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{tPurchase('columns.product')}</th>
                                <th>{tPurchase('columns.description')}</th>
                                <th style={{ textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                                <th style={{ textAlign: 'right' }}>{tPurchase('columns.received')}</th>
                                 <th style={{ textAlign: 'right' }}>{tPurchase('columns.billed')}</th>
                                <th style={{ width: 180 }}>Receipt Mapping</th>
                                <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.qtyToBill')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newInvoiceLines.map((nl, idx) => {
                                const origLine = order.lines.find(l => l.purchaseOrderLineId === nl.purchaseOrderLineId);
                                const receivedQty = parseFloat(origLine?.quantityReceived || '0');
                                const InvoicedQty = Invoices.reduce((sum, inv) => {
                                    const invLine = inv.lines?.find(il => il.purchaseOrderLineId === nl.purchaseOrderLineId);
                                    return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                                }, 0);

                                const lineReceipts = receiptLines.filter(r => r.line.purchaseOrderLineId === nl.purchaseOrderLineId);

                                return (
                                    <tr key={nl.purchaseOrderLineId}>
                                        <td style={{ color: 'var(--text-muted)' }}>{origLine?.lineNumber}</td>
                                        <td style={{ fontWeight: 600, fontSize: 12 }}>
                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                        </td>
                                        <td>{origLine?.productDescription || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{origLine?.quantity}</td>
                                        <td style={{ textAlign: 'right' }}>{receivedQty}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{InvoicedQty}</td>
                                        <td>
                                            {lineReceipts.length > 0 ? (
                                                <select
                                                    className="input w-full"
                                                    style={{ padding: '2px 4px', fontSize: 11 }}
                                                    value={nl.goodsReceivedLineId || ''}
                                                    onChange={e => {
                                                        const updated = [...newInvoiceLines];
                                                        const val = e.target.value;
                                                        updated[idx].goodsReceivedLineId = val || undefined;
                                                        if (val) {
                                                            const rect = lineReceipts.find(r => r.line.goodsReceivedLineId === val);
                                                            if (rect) {
                                                                // Pre-fill remaining for this receipt
                                                                const billedOnThisRect = Invoices.reduce((sum, inv) => {
                                                                    const invLine = inv.lines?.find(il => il.goodsReceivedLineId === val);
                                                                    return sum + (invLine ? parseFloat(invLine.quantityBilled || '0') : 0);
                                                                }, 0);
                                                                const rem = Math.max(0, parseFloat(rect.line.quantityReceived) - billedOnThisRect);
                                                                updated[idx].quantityToInvoice = String(rem);
                                                                updated[idx].maxQuantity = rem;
                                                            }
                                                        } else {
                                                            // Revert to PO-wide remaining
                                                            updated[idx].maxQuantity = Math.max(0, receivedQty - InvoicedQty);
                                                            updated[idx].quantityToInvoice = String(updated[idx].maxQuantity);
                                                        }
                                                        setNewInvoiceLines(updated);
                                                    }}
                                                >
                                                    <option value="">{tCommon('none')} (PO Direct)</option>
                                                    {lineReceipts.map(r => (
                                                        <option key={r.line.goodsReceivedLineId} value={r.line.goodsReceivedLineId}>
                                                            {r.receiptNumber} ({r.line.quantityReceived})
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No receipts found</span>
                                            )}
                                        </td>
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
                        <button className="btn btn-primary btn-sm" disabled={invoicing || !supplierinvoiceNumber.trim() || newInvoiceLines.every(l => !l.quantityToInvoice || parseFloat(l.quantityToInvoice) <= 0)} onClick={handleGenerate}>
                            {tPurchase('buttons.submitBill')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                            {tCommon('cancel')}
                        </button>
                    </div>
                </div>
            )}

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
                            const cc = order.currencyCode || HOME_CURRENCY.code;
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
