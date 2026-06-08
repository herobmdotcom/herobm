/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';
import React, { useState, useEffect } from 'react';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage } from '@modbm/shared';

import CustomerSelect from '@/components/shared/CustomerSelect';

export default function AdHocCreditNoteSlideOver({
    isOpen,
    onClose,
    onSuccess,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const tCommon = useTranslations('common');
    const [saving, setSaving] = useState(false);
    const [customerId, setCustomerId] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<Array<{ description: string; amount: string; accountId: string }>>([]);

    const [accounts, setAccounts] = useState<api.GlAccountResponseDto[]>([]);

    useEffect(() => {
        if (isOpen) {
            setCustomerId('');
            setNotes('');
            setLines([{ description: '', amount: '', accountId: '' }]);

            // Fetch GL accounts
            api.glControllerGetAccounts().then(res => setAccounts(res.data)).catch(console.error);
        }
    }, [isOpen]);

    const handleAddLine = () => {
        setLines([...lines, { description: '', amount: '', accountId: '' }]);
    };

    const handleLineChange = (index: number, field: string, value: string) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleRemoveLine = (index: number) => {
        const newLines = [...lines];
        newLines.splice(index, 1);
        setLines(newLines);
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const formattedLines = lines.map(l => ({
                description: l.description,
                amount: parseFloat(l.amount),
                accountId: l.accountId,
            }));

            await api.salesCreditNotesControllerCreateCreditNote({
                customerId,
                notes,
                lines: formattedLines,
            } as any); // using any for quick SDK type bypass just in case

            toast.success('Credit note issued successfully');
            onSuccess();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err) || 'Failed to issue credit note');
        } finally {
            setSaving(false);
        }
    };

    const isInvalid = !customerId || lines.length === 0 || lines.some(l => !l.description || !l.amount || parseFloat(l.amount) <= 0 || !l.accountId);

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title="Issue Ad-Hoc Credit Note"
            width="max-w-2xl"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        {tCommon('cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm" 
                        disabled={saving || isInvalid}
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
                <div className="form-control w-full">
                    <label className="label text-sm font-medium">Customer</label>
                    <CustomerSelect
                        value={customerId}
                        onChange={(acc) => setCustomerId(acc?.customerId || '')}
                        placeholder="Select Customer..."
                        required
                    />
                </div>

                <div className="form-control w-full">
                    <label className="label text-sm font-medium">Internal Note / Reason</label>
                    <textarea 
                        className="textarea textarea-bordered w-full"
                        placeholder="Reason for issuing credit note..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                    />
                </div>

                <div className="mt-4 border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-secondary)] shadow-sm">
                    <div className="flex justify-between items-center p-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                        <span className="font-medium">Credit Lines</span>
                        <button onClick={handleAddLine} className="btn btn-xs btn-outline">
                            <span className="material-symbols-outlined text-sm">add</span> Add Line
                        </button>
                    </div>
                    
                    <table className="table-lines w-full">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Description</th>
                                <th style={{ textAlign: 'left', width: '180px' }}>GL Account</th>
                                <th style={{ textAlign: 'right', width: '120px' }}>Amount</th>
                                <th style={{ width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, index) => (
                                <tr key={index}>
                                    <td>
                                        <input 
                                            type="text" 
                                            className="input input-sm input-bordered w-full"
                                            placeholder="Description..."
                                            value={line.description}
                                            onChange={e => handleLineChange(index, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <select 
                                            className="select select-sm select-bordered w-full"
                                            value={line.accountId}
                                            onChange={e => handleLineChange(index, 'accountId', e.target.value)}
                                        >
                                            <option value="" disabled>Select</option>
                                            {accounts.map(a => (
                                                <option key={a.glAccountId} value={a.glAccountId}>{a.name} ({a.accountCode})</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input 
                                            type="number" 
                                            className="input input-sm input-bordered w-full text-right"
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0.01"
                                            value={line.amount}
                                            onChange={e => handleLineChange(index, 'amount', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button 
                                            className="btn btn-ghost btn-xs text-error" 
                                            onClick={() => handleRemoveLine(index)}
                                            disabled={lines.length === 1}
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {lines.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-sm text-[var(--text-muted)]">
                                        No lines added.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    
                    {lines.length > 0 && (
                        <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex justify-end">
                            <span className="font-medium mr-4">Total:</span>
                            <span className="font-bold font-mono">
                                {lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </SlideOver>
    );
}
