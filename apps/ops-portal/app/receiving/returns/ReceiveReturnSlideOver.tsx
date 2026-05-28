import React, { useState, useEffect } from 'react';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';

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
    const t = useTranslations('goodsReceived');
    const [saving, setSaving] = useState(false);
    const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && returnRecord) {
            const initialQuantities: Record<string, string> = {};
            for (const line of returnRecord.lines || []) {
                const pending = parseFloat(line.quantityReturned) - parseFloat(line.quantityReceived || '0');
                initialQuantities[line.returnLineId] = pending > 0 ? pending.toString() : '0';
            }
            setLineQuantities(initialQuantities);
        }
    }, [isOpen, returnRecord]);

    if (!returnRecord) return null;

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const linesToReceive = returnRecord.lines
                .map((line: any) => ({
                    returnLineId: line.returnLineId,
                    quantityReceived: lineQuantities[line.returnLineId] || '0',
                }))
                .filter((l: any) => parseFloat(l.quantityReceived) > 0);

            if (linesToReceive.length > 0) {
                await api.orderReturnsControllerReceiveReturn(returnRecord.salesOrderId, returnRecord.returnId, {
                    locationId: returnRecord.locationId,
                    lines: linesToReceive
                } );
            }

            onRefresh();
            toast.success('Return received successfully');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to receive return');
        } finally {
            setSaving(false);
        }
    };

    const hasInvalidQuantities = (returnRecord.lines || []).some((l: any) => {
        const val = parseFloat(lineQuantities[l.returnLineId] || '0');
        const max = parseFloat(l.quantityReturned) - parseFloat(l.quantityReceived || '0');
        return val < 0 || val > max || isNaN(val);
    });

    const hasZeroQuantities = Object.values(lineQuantities).every(v => !v || parseFloat(v) === 0);

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={`Receive Return: ${returnRecord.returnNumber}`}
            width="max-w-xl"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        {tCommon('cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm" 
                        disabled={saving || hasInvalidQuantities || hasZeroQuantities}
                    >
                        {saving ? (
                            <><span className="loading loading-spinner loading-sm mr-2" />{t('returns.receiving')}</>
                        ) : (
                            t('returns.confirmReceipt')
                        )}
                    </button>
                </div>
            }
        >
            <div className="mb-4">
                <span className="text-sm text-[var(--text-secondary)] mr-2">{t('columns.return.order')}</span>
                <Link href={`/sales-orders/${returnRecord.salesOrderId}`} className="text-sm font-medium text-[var(--accent)] hover:underline" onClick={onClose}>
                    {returnRecord.orderNumber}
                </Link>
            </div>

            <table className="table-lines w-full">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>{t('columns.return.product')}</th>
                        <th style={{ textAlign: 'left' }}>{t('columns.return.description')}</th>
                        <th style={{ textAlign: 'right' }}>{t('columns.return.expectedQty')}</th>
                        <th style={{ textAlign: 'right' }}>{t('columns.return.received')}</th>
                        <th style={{ textAlign: 'right' }}>{t('columns.return.receiveNow')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(returnRecord.lines || []).map((line: any) => (
                        <tr key={line.returnLineId}>
                            <td className="text-sm font-semibold">
                                {line.productId ? (
                                    <Link href={`/products/${line.productId}`} className="text-[var(--accent)] hover:underline" onClick={onClose}>
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
        </SlideOver>
    );
}
