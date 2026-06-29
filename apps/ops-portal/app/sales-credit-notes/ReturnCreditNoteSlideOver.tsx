
'use client';
import React, { useState } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage } from '@herobm/shared';

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

    // Reset notes when opening a new record
    React.useEffect(() => {
        if (isOpen && returnRecord) {
            setNotes(`Credit note for return ${returnRecord.returnNumber}`);
        }
    }, [isOpen, returnRecord]);

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

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={`Issue Credit Note for Return: ${returnRecord.returnNumber}`}
            width="max-w-xl"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        {tCommon('cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white" 
                        disabled={saving}
                    >
                        {saving ? (
                            <><span className="loading loading-spinner loading-sm mr-2" />{t('issuing')}</>
                        ) : (
                            t('issueCreditNote')
                        )}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div>
                    <span className="text-sm text-[var(--text-secondary)] mr-2">{t('order')}</span>
                    <Link href={`/sales-orders/${returnRecord.salesOrderId}`} className="text-sm font-medium text-[var(--accent)] hover:underline" onClick={onClose}>
                        {returnRecord.orderNumber}
                    </Link>
                </div>

                <div className="form-control w-full">
                    <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">{t('internalNote')}</label>
                    <textarea 
                        className="textarea textarea-bordered w-full"
                        placeholder="Reason for issuing credit note..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                    />
                </div>

                <div className="mt-4 border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
                    <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                        <span className="font-medium text-sm">{t('returnItemsToCredit')}</span>
                    </div>
                    <table className="table-lines w-full text-sm">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>{t('product')}</th>
                                <th style={{ textAlign: 'left' }}>{t('description')}</th>
                                <th style={{ textAlign: 'right' }}>{t('qtyToCredit')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                            {(returnRecord.lines || []).map((line: any) => (
                                <tr key={line.returnLineId}>
                                    <td className="font-semibold">
                                        {line.productNumber || '—'}
                                    </td>
                                    <td>{line.productDescription || '—'}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                        {line.quantityReturned}
                                    </td>
                                </tr>
                            ))}
                            {(!returnRecord.lines || returnRecord.lines.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="text-center py-4 text-[var(--text-muted)]">{t('noLinesFound')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </SlideOver>
    );
}
