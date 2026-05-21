import React, { useState, useEffect } from 'react';
import { apiMutate } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { RETURN_STATE } from '@modbm/shared';
import Link from 'next/link';

export default function ReceiveReturnSlideOver({
    isOpen,
    onClose,
    returnRecord,
    onRefresh
}: {
    isOpen: boolean;
    onClose: () => void;
    returnRecord: any | null;
    onRefresh: () => void;
}) {
    const tCommon = useTranslations('common');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && returnRecord) {
            setError(null);
            const initialQuantities: Record<string, string> = {};
            for (const line of returnRecord.lines || []) {
                const pending = parseFloat(line.quantityReturned) - parseFloat(line.quantityReceived || '0');
                initialQuantities[line.returnLineId] = pending > 0 ? pending.toString() : '0';
            }
            setLineQuantities(initialQuantities);
        }
    }, [isOpen, returnRecord]);

    if (!isOpen || !returnRecord) return null;

    const handleConfirm = async () => {
        setSaving(true);
        setError(null);
        try {
            const linesToReceive = returnRecord.lines
                .map((line: any) => ({
                    returnLineId: line.returnLineId,
                    quantityReceived: lineQuantities[line.returnLineId] || '0',
                }))
                .filter((l: any) => parseFloat(l.quantityReceived) > 0);

            if (linesToReceive.length > 0) {
                await apiMutate(`/api/sales-orders/${returnRecord.salesOrderId}/returns/${returnRecord.returnId}/receive`, 'POST', {
                    locationId: returnRecord.locationId,
                    lines: linesToReceive
                });
            }

            onRefresh();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to receive return');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-xl h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col flex-nowrap animate-slide-in-right">
                <div className="flex-none p-5 lg:p-6 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Receive Return: {returnRecord.returnNumber}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors text-[var(--text-muted)]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-5 lg:p-6 bg-[var(--bg-card)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <span className="text-sm text-[var(--text-secondary)] mr-2">Order:</span>
                        <Link href={`/sales-orders/${returnRecord.salesOrderId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                            {returnRecord.orderNumber}
                        </Link>
                    </div>

                    <table className="table-lines w-full">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Product</th>
                                <th style={{ textAlign: 'left' }}>Description</th>
                                <th style={{ textAlign: 'right' }}>Expected Qty</th>
                                <th style={{ textAlign: 'right' }}>Received</th>
                                <th style={{ textAlign: 'right' }}>Receive Now</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(returnRecord.lines || []).map((line: any) => (
                                <tr key={line.returnLineId}>
                                    <td className="text-sm font-semibold">
                                        {line.productId ? (
                                            <Link href={`/products/${line.productId}`} className="text-[var(--accent)] hover:underline">
                                                {line.productNumber || '—'}
                                            </Link>
                                        ) : (
                                            line.productNumber || '—'
                                        )}
                                    </td>
                                    <td className="text-sm">{line.productDescription || '—'}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                        {line.quantityReturned}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                        {line.quantityReceived || '0'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <input
                                            className="input text-right w-24"
                                            type="number"
                                            min="0"
                                            max={parseFloat(line.quantityReturned) - parseFloat(line.quantityReceived || '0')}
                                            step="1"
                                            value={lineQuantities[line.returnLineId] || ''}
                                            onChange={e => setLineQuantities(prev => ({ ...prev, [line.returnLineId]: e.target.value }))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex-none p-5 lg:p-6 border-t border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-end gap-3">
                    <button 
                        onClick={handleConfirm} 
                        className="btn btn-primary" 
                        disabled={saving || (returnRecord.lines || []).some((l: any) => {
                            const val = parseFloat(lineQuantities[l.returnLineId] || '0');
                            const max = parseFloat(l.quantityReturned) - parseFloat(l.quantityReceived || '0');
                            return val < 0 || val > max || isNaN(val);
                        }) || Object.values(lineQuantities).every(v => !v || parseFloat(v) === 0)}
                    >
                        {saving ? 'Receiving...' : 'Confirm Receipt'}
                    </button>
                </div>
            </div>
        </div>
    );
}
