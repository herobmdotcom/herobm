/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';
import React, { useState } from 'react';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage } from '@modbm/shared';

export default function ReturnCreditNoteSlideOver({
    isOpen,
    onClose,
    returnRecord,
    onSuccess,
}: {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    returnRecord: any | null;
    onSuccess: () => void;
}) {
    const tCommon = useTranslations('common');
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
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm" 
                        disabled={saving}
                    >
                        {saving ? (
                            <><span className="loading loading-spinner loading-sm mr-2" />Issuing...</>
                        ) : (
                            'Issue Credit Note'
                        )}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div>
                    <span className="text-sm text-[var(--text-secondary)] mr-2">Order:</span>
                    <Link href={`/sales-orders/${returnRecord.salesOrderId}`} className="text-sm font-medium text-[var(--accent)] hover:underline" onClick={onClose}>
                        {returnRecord.orderNumber}
                    </Link>
                </div>

                <div className="form-control w-full">
                    <label className="label text-sm font-medium">Internal Note / Reason</label>
                    <textarea 
                        className="textarea textarea-bordered w-full"
                        placeholder="Reason for issuing credit note..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                    />
                </div>

                <div className="mt-4 border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-secondary)] shadow-sm">
                    <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                        <span className="font-medium text-sm">Return Items to Credit</span>
                    </div>
                    <table className="table-lines w-full text-sm">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Product</th>
                                <th style={{ textAlign: 'left' }}>Description</th>
                                <th style={{ textAlign: 'right' }}>Qty to Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                                    <td colSpan={3} className="text-center py-4 text-[var(--text-muted)]">No lines found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </SlideOver>
    );
}
