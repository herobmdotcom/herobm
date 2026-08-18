'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { toast } from 'react-hot-toast';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import { useAuth } from '@/components/AuthGate';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { routes } from '@/lib/routes';

import { SalesInvoice, TaxCategory, OrderDetail, OrderReturn } from './types';
import { SALES_INVOICE_STATE } from '@herobm/shared';
import type { NewInvoiceLine } from './useOrder';
import { calculateInvoiceableQuantities } from '@/lib/sales-order-utils';
import { useSettings } from '@/components/SettingsProvider';

interface InvoicesSectionProps {
    orderId: string;
    order: OrderDetail;
    invoices: SalesInvoice[];
    returns?: OrderReturn[];
    taxCategories: TaxCategory[];
    onEmailDocumentClick?: (hookSlug: string, title: string, prefix: string, docName: string, targetId: string, contextSlug: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    pickingSummary: Record<string, any> | null;
    setError: (msg: string) => void;
    loadInvoices: () => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    loadOrder: (autoTransitions?: Record<string, any>[], showSpinner?: boolean) => Promise<void>;
}

export default function InvoicesSection({
    orderId, order, invoices, returns,
    pickingSummary, setError, loadInvoices, loadOrder, onEmailDocumentClick
}: InvoicesSectionProps) {
    const { baseCurrency } = useSettings();
    const { permissions } = useAuth();
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
            order.lines, invoices, pickingSummary?.lines, returns
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
                    <Button
                        variant="secondary" size="sm"
                        disabled={(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
                            const totalShipped = pickingSummary?.lines?.reduce((sum: number, pl: any) => sum + parseFloat(pl.quantityShipped || '0'), 0) || 0;
                            return totalShipped === 0;
                        })()}
                        onClick={handleCreateClick}
                    >
                        {tSales('buttons.createInvoice')}
                    </Button>
                )}
            </div>

            {showCreateInvoice && (
                <div className="mb-4 p-4 rounded-lg border border-[var(--border)]">
                    <div className="mb-3">
                        <strong className="text-[13px] flex items-center">
                            New Invoice
                        </strong>
                    </div>
                    <div className="mb-3">
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
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
                                    <td className="text-[var(--text-muted)]">{origLine?.lineNumber}</td>
                                    <td className="font-semibold text-xs">
                                        {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                    </td>
                                    <td>{origLine?.productDescription || '—'}</td>
                                    <td className="text-right">{origLine?.quantity}</td>
                                    <td className="text-right">{pickedQty}</td>
                                    <td className="text-right">{shippedQty}</td>
                                    <td className="text-right text-[var(--text-muted)]">{invoicedQty}</td>
                                    <td className="text-right">
                                        <input
                                            type="number"
                                            className="input w-[70px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13px] text-right"
                                            min="0"
                                            max={nl.maxQuantity}
                                            step="1"
                                            value={nl.quantityToInvoice}
                                            onChange={e => {
                                                const updated = [...newInvoiceLines];
                                                let val = e.target.value;
                                                if (val === '') val = '0';
                                                else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                updated[idx].quantityToInvoice = val;
                                                setNewInvoiceLines(updated);
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        }}
                        mobileCard={(nl, idx) => {
                            const origLine = order.lines.find(l => l.salesOrderLineId === nl.salesOrderLineId);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{origLine?.lineNumber}</div>
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
                                                type="number"
                                                className="input w-[70px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13px] text-right"
                                                min="0"
                                                max={nl.maxQuantity}
                                                step="1"
                                                value={nl.quantityToInvoice}
                                                onChange={e => {
                                                    const updated = [...newInvoiceLines];
                                                    let val = e.target.value;
                                                    if (val === '') val = '0';
                                                    else if (val.startsWith('0') && val.length > 1) val = val.replace(/^0+/, '') || '0';
                                                    updated[idx].quantityToInvoice = val;
                                                    setNewInvoiceLines(updated);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />
                    
                    <div className="flex items-center gap-2 mt-4">
                        <Button variant="primary" size="sm" disabled={invoicing || newInvoiceLines.every(l => !l.quantityToInvoice || parseFloat(l.quantityToInvoice) <= 0)} onClick={handleGenerate}>
                            {tSales('buttons.createInvoice')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleCancel}>
                            {tCommon('cancel')}
                        </Button>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-2">
                {invoices.map((inv) => (
                    <LinkedEntityCard
                        key={inv.invoiceId}
                        icon="receipt_long"
                        title={inv.invoiceNumber}
                        href={routes.salesInvoices.detail(inv.invoiceId)}
                        subtitle={[
                            formatLocalDate(inv.createdOn),
                            inv.createdBy ? tCommon('timeline.by', { actor: inv.createdBy }) : null,
                        ]}
                        amount={formatAmount(parseFloat(inv.totalAmount || '0'), order.currencyCode || baseCurrency)}
                        amountSubtext={`${tCommon('tax')}: ${formatAmount(parseFloat(inv.taxAmount || '0'), order.currencyCode || baseCurrency)}`}
                        status={inv.stateCode}
                        actions={
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (onEmailDocumentClick) {
                                        onEmailDocumentClick('sales-invoice', 'Email Sales Invoice', 'Invoice', 'Sales Invoice', inv.invoiceId, 'sales-invoice');
                                    }
                                }}
                            >
                                <span className="material-symbols-outlined text-[20px]">mail</span>
                                <span className="sr-only">Email Invoice</span>
                            </Button>
                        }
                    />
                ))}
                {invoices.length === 0 && (
                    <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                        {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
