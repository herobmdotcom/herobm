'use client';
import React, { useState } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage, computeReturnCreditSummary, computeLinePrice, RETURN_RESOLUTION } from '@herobm/shared';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';

export default function ReturnCreditNoteSlideOver({
    isOpen,
    onClose,
    returnRecord,
    onSuccess,
}: {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    returnRecord: any | null;
    onSuccess: () => void;
}) {
    const tCommon = useTranslations('common');
    const t = useTranslations('portal');
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const [fullReturn, setFullReturn] = useState<any>(null);

    // Reset notes when opening a new record
    React.useEffect(() => {
        if (isOpen && returnRecord) {
            setNotes(`Credit note for return ${returnRecord.returnNumber}`);
            
            api.globalReturnsControllerFindOne(returnRecord.returnId)
                .then(res => setFullReturn(res.data))
                .catch(err => reportError(err, 'Failed to fetch return details'));
        } else {
            setFullReturn(null);
        }
    }, [isOpen, returnRecord]);

    const totalAmount = React.useMemo(() => {
        if (!returnRecord?.lines) return 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        return returnRecord.lines.reduce((acc: number, line: any) => {
            const qty = parseFloat(line.quantityReturned) || 0;
            const price = parseFloat(line.pricePerUnit) || 0;
            const discount = parseFloat(line.discountPercentage) || 0;
            const tax = parseFloat(line.taxRate) || 0;
            const fee = parseFloat(line.returnFee) || 0;
            
            const discountedPrice = price * (1 - discount / 100);
            const lineTotal = qty * discountedPrice;
            const lineTax = lineTotal * (tax / 100);
            return acc + Math.max(0, lineTotal + lineTax - fee);
        }, 0);
    }, [returnRecord]);

    const creditSummary = React.useMemo(() => {
        const targetRecord = fullReturn || returnRecord;
        if (!targetRecord?.lines) return { subtotal: 0, totalTax: 0, totalFees: 0, netCredit: 0 };
        return computeReturnCreditSummary(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            targetRecord.lines.map((l: any) => ({
                quantity: parseFloat(l.quantityReturned || '0'),
                pricePerUnit: parseFloat(l.pricePerUnit || '0'),
                discountPercentage: parseFloat(l.discountPercentage || '0'),
                taxRate: parseFloat(l.taxRate || '0'),
                returnFee: parseFloat(l.returnFee || '0'),
                resolution: l.resolution,
            })),
        );
    }, [fullReturn, returnRecord]);

    if (!returnRecord) return null;

    const handleConfirm = async () => {
        setSaving(true);
        try {
            await api.salesCreditNotesControllerCreateCreditNote({
                returnId: returnRecord.returnId,
                notes: notes,
            });

            toast.success('Credit note issued successfully');
            onSuccess();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err) || 'Failed to issue credit note');
        } finally {
            setSaving(false);
        }
    };

    const linesFooter = (
        <>
            <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
                <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
                    Subtotal
                </td>
                <td className="text-right tabular-nums font-semibold">
                    {formatAmount(creditSummary.subtotal, returnRecord?.currencyCode || 'USD')}
                </td>
            </tr>
            <tr className="hidden lg:table-row">
                <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
                    Total Tax
                </td>
                <td className="text-right tabular-nums font-semibold">
                    {formatAmount(creditSummary.totalTax, returnRecord?.currencyCode || 'USD')}
                </td>
            </tr>
            {creditSummary.totalFees > 0 && (
                <tr className="hidden lg:table-row">
                    <td colSpan={6} className="text-right font-semibold text-xs text-[var(--text-muted)]">
                        Total Fees
                    </td>
                    <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
                        -{formatAmount(creditSummary.totalFees, returnRecord?.currencyCode || 'USD')}
                    </td>
                </tr>
            )}
            <tr className="hidden lg:table-row">
                <td colSpan={6} className="text-right font-semibold text-[13px] text-[var(--text-primary)]">
                    Net Credit
                </td>
                <td className="text-right tabular-nums font-bold text-[14px]">
                    {formatAmount(creditSummary.netCredit, returnRecord?.currencyCode || 'USD')}
                </td>
            </tr>
        </>
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const lineColumns: DataTableColumn<any>[] = [
        {
            id: 'product',
            header: 'Product',
            width: 150,
            render: (line) => (
                <div className="font-semibold text-[var(--accent)]">
                    {line.productNumber}
                </div>
            )
        },
        {
            id: 'description',
            header: 'Description',
            render: (line) => line.productDescription || line.description || '—',
        },
        {
            id: 'qty',
            header: 'Return Qty',
            width: 90,
            align: 'right',
            render: (line) => <span className="tabular-nums">{parseFloat(line.quantityReturned)}</span>,
        },
        {
            id: 'reason',
            header: 'Return Reason',
            width: 150,
            render: (line) => line.reason || fullReturn?.notes || returnRecord?.notes || '—',
        },
        {
            id: 'resolution',
            header: 'Resolution',
            width: 110,
            render: (line) => line.resolution || '—',
        },
        {
            id: 'fee',
            header: 'Fee',
            width: 110,
            align: 'right',
            render: (line) => (
                <span className="font-semibold tabular-nums">
                    {parseFloat(line.returnFee || '0') > 0 ? formatAmount(parseFloat(line.returnFee || '0'), returnRecord?.currencyCode || 'USD') : '—'}
                </span>
            ),
        },
        {
            id: 'amount',
            header: 'Amount',
            width: 130,
            align: 'right',
            render: (line) => {
                const qty = parseFloat(line.quantityReturned || '0');
                const price = parseFloat(line.pricePerUnit || '0');
                const disc = parseFloat(line.discountPercentage || '0');
                const grossLine = computeLinePrice({
                    quantity: qty,
                    pricePerUnit: price,
                    discountPercentage: disc,
                    taxRate: parseFloat(line.taxRate || '0')
                }).amount;
                const fee = parseFloat(line.returnFee || '0');
                const lineAmount = Math.max(0, grossLine - fee);
                return (
                    <span className="font-semibold tabular-nums">
                        {formatAmount(lineAmount, returnRecord?.currencyCode || 'USD')}
                    </span>
                );
            },
        }
    ];

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={t('issueCreditNote')}
            width="max-w-4xl"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <Button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        {tCommon('cancel')}
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white" 
                        disabled={saving}
                    >
                        {saving ? (
                            <><span className="loading loading-spinner loading-sm mr-2" />{t('issuing')}</>
                        ) : (
                            t('issueCreditNote')
                        )}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <div>
                    <div className="grid grid-cols-2 gap-5 text-sm">
                        <div>
                            <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">Return No</span>
                            <Link href={`/sales-returns/${returnRecord.returnId}`} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                                {returnRecord.returnNumber}
                            </Link>
                        </div>
                        <div>
                            <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">Order No</span>
                            <Link href={`/sales-orders/${returnRecord.salesOrderId}`} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                                {returnRecord.orderNumber}
                            </Link>
                        </div>
                        <div className="col-span-2">
                            <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">Customer</span>
                            <span className="text-[#041627]">
                                {returnRecord.customerId ? (
                                    <Link href={`/customers/${returnRecord.customerId}`} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                                        {returnRecord.customerNumber} - {returnRecord.customerName}
                                    </Link>
                                ) : (
                                    <>{returnRecord.customerNumber} - {returnRecord.customerName}</>
                                )}
                            </span>
                        </div>
                        {(fullReturn?.notes || returnRecord.notes) && (
                            <div className="col-span-2">
                                <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">Return Reason / Notes</span>
                                <span className="text-[var(--text-primary)] font-medium">
                                    {fullReturn?.notes || returnRecord.notes}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="section-heading mb-4 flex items-center gap-2">
                        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                        <span className="material-symbols-outlined shrink-0">list</span>
                        <span>Items to Credit</span>
                    </h3>
                    <div className="card p-0 overflow-hidden">
                        <DataTable
                            data={(fullReturn || returnRecord).lines || []}
                            columns={lineColumns}
                            keyExtractor={(line) => line.returnLineId}
                            emptyMessage="No line items found"
                            footer={linesFooter}
                        />
                    </div>
                </div>

                <div>
                    <h3 className="section-heading mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined shrink-0">receipt_long</span>
                        <span>Credit Note</span>
                    </h3>
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#f8f9fa] border-b border-[var(--border)] text-[#041627] font-semibold text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 w-[160px]">Account</th>
                                    <th className="px-5 py-3 w-[220px]">Party</th>
                                    <th className="px-5 py-3 text-right w-[120px]">Debit</th>
                                    <th className="px-5 py-3 text-right w-[120px]">Credit</th>
                                    <th className="px-5 py-3">Memo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                <tr>
                                    <td className="px-5 py-3">
                                        <div className="text-xs text-[var(--text-muted)] font-mono mb-0.5">1200</div>
                                        <div className="font-semibold text-[#041627]">Accounts Receivable</div>
                                    </td>
                                    <td className="px-5 py-3">
                                        {returnRecord.customerId ? (
                                            <Link href={`/customers/${returnRecord.customerId}`} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                                                {returnRecord.customerName}
                                            </Link>
                                        ) : (
                                            <span className="text-[#041627]">{returnRecord.customerName}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-[var(--text-muted)]">N/A</td>
                                    <td className="px-5 py-3 text-right font-mono text-[#041627]">
                                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(creditSummary.netCredit)}
                                    </td>
                                    <td className="px-5 py-3">
                                        <input 
                                            type="text"
                                            className="input input-sm input-bordered w-full"
                                            placeholder="Reason for issuing credit note..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-[#f8f9fa] border-t border-[var(--border)] font-semibold text-[#041627]">
                                <tr>
                                    <td colSpan={2} className="px-5 py-3 text-right uppercase text-xs tracking-wider">Total</td>
                                    <td className="px-5 py-3 text-right font-mono text-[var(--text-muted)]">N/A</td>
                                    <td className="px-5 py-3 text-right font-mono">{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(creditSummary.netCredit)}</td>
                                    <td className="px-5 py-3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </SlideOver>
    );
}
