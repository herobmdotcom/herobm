'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import { getErrorMessage } from '@herobm/shared';
import CustomerSelect from '@/components/shared/CustomerSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useSettings } from '@/components/SettingsProvider';
import { formatAmount } from '@/lib/currency';

export type NoteType = 'credit' | 'debit';

interface NoteLine {
  description: string;
  amount: string;
  accountId: string;
}

interface CreateNoteSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: NoteType;
}

export default function CreateNoteSlideOver({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'credit',
}: CreateNoteSlideOverProps) {
  const tCommon = useTranslations('common');
  const tPortal = useTranslations('portal');
  const { baseCurrency } = useSettings();

  const [noteType, setNoteType] = useState<NoteType>(initialType);
  const [saving, setSaving] = useState(false);

  // Customer / Supplier states
  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Lines
  const [lines, setLines] = useState<NoteLine[]>([
    { description: '', amount: '', accountId: '' },
  ]);

  // Accounts
  const [accounts, setAccounts] = useState<api.GlAccountResponseDto[]>([]);

  useEffect(() => {
    if (isOpen) {
      setNoteType(initialType);
      setCustomerId('');
      setVendorId('');
      setSupplierReferenceNumber('');
      setNotes('');
      setLines([{ description: '', amount: '', accountId: '' }]);

      // Fetch active GL accounts
      api.glControllerGetAccounts({ format: 'flat' })
        .then((res) => {
          const accs = Array.isArray(res.data) ? res.data : [];
          setAccounts(accs.filter((a) => !a.isGroup && a.isActive));
        })
        .catch((err: unknown) => {
          toast.error('Failed to load accounts: ' + getErrorMessage(err));
        });
    }
  }, [isOpen, initialType]);

  const handleAddLine = () => {
    setLines([...lines, { description: '', amount: '', accountId: '' }]);
  };

  const handleLineChange = (index: number, field: keyof NoteLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
  };

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  }, [lines]);

  const isInvalid = useMemo(() => {
    if (noteType === 'credit' && !customerId) return true;
    if (noteType === 'debit' && !vendorId) return true;
    if (lines.length === 0) return true;
    return lines.some(
      (l) => !l.description.trim() || !l.amount || parseFloat(l.amount) <= 0 || !l.accountId,
    );
  }, [noteType, customerId, vendorId, lines]);

  const handleConfirm = async () => {
    if (isInvalid) return;
    setSaving(true);

    try {
      if (noteType === 'credit') {
        const formattedLines = lines.map((l) => ({
          description: l.description.trim(),
          amount: parseFloat(l.amount),
          accountId: l.accountId,
        }));

        await api.salesCreditNotesControllerCreateCreditNote({
          customerId,
          notes: notes.trim() || undefined,
          lines: formattedLines,
        });

        toast.success('Credit note issued successfully');
      } else {
        const formattedLines = lines.map((l) => ({
          description: l.description.trim(),
          amount: parseFloat(l.amount).toFixed(2),
          accountId: l.accountId,
          quantityInvoiced: '1',
          pricePerUnit: parseFloat(l.amount).toFixed(2),
        }));

        await api.purchaseDebitNotesControllerCreateDebitNote({
          vendorId,
          supplierReferenceNumber: supplierReferenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          lines: formattedLines,
        });

        toast.success('Debit note issued successfully');
      }

      onSuccess();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) ||
          (noteType === 'credit' ? 'Failed to issue credit note' : 'Failed to issue debit note'),
      );
    } finally {
      setSaving(false);
    }
  };

  const detailsSectionTitle = noteType === 'credit' ? 'Customer Details' : 'Supplier Details';
  const linesSectionTitle = noteType === 'credit' ? 'Credit Note Lines' : 'Debit Note Lines';
  const notesPlaceholder =
    noteType === 'credit'
      ? 'Reason for issuing credit note...'
      : 'Reason for issuing debit note...';

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={noteType === 'credit' ? 'Issue Credit Note' : 'Issue Debit Note'}
      subtitle="Create an ad-hoc Credit Note for a customer or Debit Note for a supplier"
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-end w-full gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isInvalid}
            loading={saving}
          >
            {saving
              ? tPortal('issuing')
              : noteType === 'credit'
              ? tPortal('issueCreditNote')
              : tPortal('issueDebitNote')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Note Type Selector */}
        <Tabs<NoteType>
          tabs={[
            { id: 'credit', label: 'Credit Note (Customer)' },
            { id: 'debit', label: 'Debit Note (Supplier)' },
          ]}
          activeTab={noteType}
          onChange={(newType) => setNoteType(newType)}
        />

        {/* Primary Information Section */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {detailsSectionTitle}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {noteType === 'credit' ? (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <CustomerSelect
                  value={customerId}
                  onChange={(acc) => setCustomerId(acc?.customerId || '')}
                  placeholder="Select Customer..."
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <SupplierSelect
                    value={vendorId}
                    onChange={(supp) => setVendorId(supp?.vendorId || '')}
                    placeholder="Select Supplier..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Supplier Reference #
                  </label>
                  <input
                    type="text"
                    className="input text-sm h-10 border-gray-200 bg-white rounded-lg w-full px-3"
                    placeholder="e.g. DN-SUP-1029"
                    value={supplierReferenceNumber}
                    onChange={(e) => setSupplierReferenceNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Internal Note / Reason
              </label>
              <textarea
                className="textarea input text-sm border-gray-200 bg-white rounded-lg w-full p-3 min-h-[70px]"
                placeholder={notesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Lines Table Card */}
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-[#f8f9fa]">
            <span className="font-semibold text-xs text-[#041627] uppercase tracking-wider">
              {linesSectionTitle}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddLine}
            >
              Add Line
            </Button>
          </div>

          <table className="w-full text-sm text-left">
            <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 w-[240px]">GL Account</th>
                <th className="px-4 py-2.5 w-[140px] text-right">Amount</th>
                <th className="w-[48px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      className="input text-xs h-9 border-gray-200 bg-white rounded-lg w-full px-2.5"
                      placeholder="Line description..."
                      value={line.description}
                      onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="select text-xs h-9 border-gray-200 bg-white rounded-lg w-full px-2"
                      value={line.accountId}
                      onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                    >
                      <option value="" disabled>
                        Select Account...
                      </option>
                      {accounts.map((a) => (
                        <option key={a.glAccountId} value={a.glAccountId}>
                          {a.accountCode} · {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      className="input text-xs h-9 border-gray-200 bg-white rounded-lg w-full text-right font-mono px-2.5"
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      value={line.amount}
                      onChange={(e) => handleLineChange(index, 'amount', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded disabled:opacity-30 border-none bg-transparent"
                      onClick={() => handleRemoveLine(index)}
                      disabled={lines.length === 1}
                      title="Remove line"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-[#f8f9fa] border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-[#041627] text-xs uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-sm text-[#041627]">
                    {formatAmount(totalAmount, baseCurrency)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </SlideOver>
  );
}
