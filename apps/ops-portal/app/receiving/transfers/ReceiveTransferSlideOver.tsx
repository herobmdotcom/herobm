import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage } from '@herobm/shared';

export default function ReceiveTransferSlideOver({
    isOpen,
    onClose,
    transferRecord,
    onRefresh
}: {
    isOpen: boolean;
    onClose: () => void;
    transferRecord: Record<string, unknown> | null;
    onRefresh: () => void;
}) {
    const tCommon = useTranslations('common');
    const tTransfers = useTranslations('transfers');
    const t = useTranslations('goodsReceived');
    const [saving, setSaving] = useState(false);
    const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});

    const [transferDetails, setTransferDetails] = useState<api.TransferResponseDto | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && transferRecord && transferRecord.id) {
            setLoading(true);
            api.transfersControllerFindOne(transferRecord.id as string)
            .then(res => {
                setTransferDetails(res.data);
                
                const initialQuantities: Record<string, string> = {};
                for (const line of res.data.lines || []) {
                    const pending = parseFloat(line.quantityShipped || '0') - parseFloat(line.quantityReceived || '0');
                    initialQuantities[line.transferOrderLineId as string] = pending > 0 ? pending.toString() : '0';
                }
                setLineQuantities(initialQuantities);
            })
            .catch(err => toast.error(getErrorMessage(err) || 'Failed to load transfer details'))
            .finally(() => setLoading(false));
        }
    }, [isOpen, transferRecord]);

    if (!transferRecord) return null;

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const linesToReceive = (transferDetails?.lines || [])
                .map((line) => ({
                    transferOrderLineId: line.transferOrderLineId as string,
                    quantityReceived: lineQuantities[line.transferOrderLineId as string] || '0',
                }))
                .filter(l => parseFloat(l.quantityReceived) > 0);

            if (linesToReceive.length > 0) {
                await api.transfersControllerReceiveTransferOrder(transferRecord.id as string, {
                    lines: linesToReceive
                });
            }

            onRefresh();
            toast.success('Transfer received successfully');
            onClose();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err) || 'Failed to receive transfer');
        } finally {
            setSaving(false);
        }
    };

    const hasInvalidQuantities = (transferDetails?.lines || []).some((l) => {
        const val = parseFloat(lineQuantities[l.transferOrderLineId as string] || '0');
        const max = parseFloat(l.quantityShipped || '0') - parseFloat(l.quantityReceived || '0');
        return val < 0 || val > max || isNaN(val);
    });

    const hasZeroQuantities = Object.values(lineQuantities).every(v => !v || parseFloat(v) === 0);

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={`Receive Transfer: ${(transferRecord.orderNumber as string)}`}
            width="max-w-xl"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        {tCommon('cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white" 
                        disabled={saving || hasInvalidQuantities || hasZeroQuantities || loading}
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
                <span className="text-sm text-[var(--text-secondary)] mr-2">Source Location:</span>
                <span className="text-sm font-medium">{transferRecord.sourceLocationName as string || '—'}</span>
            </div>

            {loading ? (
                <div className="flex justify-center p-4">
                    <span className="loading loading-spinner" />
                </div>
            ) : (
                <table className="table-lines w-full">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>{tTransfers('columns.product')}</th>
                            <th style={{ textAlign: 'right' }}>{tTransfers('columns.shipped')}</th>
                            <th style={{ textAlign: 'right' }}>{t('columns.return.receiveNow')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(transferDetails?.lines || []).map((line) => {
                            const max = parseFloat(line.quantityShipped || '0') - parseFloat(line.quantityReceived || '0');
                            if (max <= 0) return null; // Only show pending

                            return (
                                <tr key={line.id}>
                                    <td className="text-sm font-semibold">
                                        {line.productNumber || '—'}
                                        {line.productDescription && <div className="text-xs text-[var(--text-muted)] font-normal">{line.productDescription}</div>}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {line.quantityShipped || '0'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <input
                                            className="input text-right w-24"
                                            type="number"
                                            min="0"
                                            max={max}
                                            step="1"
                                            value={lineQuantities[line.transferOrderLineId as string] || ''}
                                            onChange={e => setLineQuantities(prev => ({ ...prev, [line.transferOrderLineId as string]: e.target.value }))}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </SlideOver>
    );
}
