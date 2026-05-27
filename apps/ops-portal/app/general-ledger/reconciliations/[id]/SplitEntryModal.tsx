import React, { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface SplitEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationId: string;
  selectedLine: any;
  onSuccess: () => void;
}

export default function SplitEntryModal({ isOpen, onClose, reconciliationId, selectedLine, onSuccess }: SplitEntryModalProps) {
  const [amount, setAmount] = useState<number | string>('');
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');

  // When modal opens or selected line changes, reset the amount
  useEffect(() => {
    if (isOpen && selectedLine) {
      const lineTotal = Number(selectedLine.debit || 0) + Number(selectedLine.credit || 0);
      setAmount(Math.ceil(lineTotal / 2).toString());
    } else {
      setAmount('');
    }
  }, [isOpen, selectedLine]);

  if (!isOpen || !selectedLine) return null;

  const lineTotal = Number(selectedLine.debit || 0) + Number(selectedLine.credit || 0);
  const isDebit = Number(selectedLine.debit || 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const val = Number(amount);
    if (isNaN(val) || val <= 0 || val >= lineTotal) {
      toast.error(t('splitEntryForm.invalidAmountError'));
      return;
    }

    setSubmitting(true);
    try {
      await api.reconciliationControllerToggleLine(reconciliationId, selectedLine.journalLineId, { isCleared: true, amount: val });
      toast.success(t('splitEntryForm.splitSuccess'));
      onSuccess();
      onClose();
    } catch (err: any) {
      reportError(err, 'SplitEntryModal_submit');
      toast.error(err.message || t('splitEntryForm.failedToSplitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-card)] rounded-xl shadow-xl max-w-md w-full border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{t('splitEntryForm.title')}</h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            {/* eslint-disable i18next/no-literal-string */}
            ✕
            {/* eslint-enable i18next/no-literal-string */}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="border border-[var(--border)] rounded-lg overflow-hidden text-sm">
            <div className="grid grid-cols-[100px_1fr] border-b border-[var(--border)]">
              <div className="bg-[var(--bg-secondary)] px-3 py-2 font-bold text-[var(--text-secondary)]">{t('splitEntryForm.date')}</div>
              <div className="px-3 py-2 text-[var(--text-primary)] bg-[var(--bg-card)]">{selectedLine.entryDate || '-'}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr] border-b border-[var(--border)]">
              <div className="bg-[var(--bg-secondary)] px-3 py-2 font-bold text-[var(--text-secondary)]">{t('splitEntryForm.party')}</div>
              <div className="px-3 py-2 text-[var(--text-primary)] bg-[var(--bg-card)]">{selectedLine.partyName || selectedLine.partyId || '-'}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr] border-b border-[var(--border)]">
              <div className="bg-[var(--bg-secondary)] px-3 py-2 font-bold text-[var(--text-secondary)]">{t('splitEntryForm.memo')}</div>
              <div className="px-3 py-2 text-[var(--text-primary)] bg-[var(--bg-card)] truncate" title={selectedLine.memo || '-'}>{selectedLine.memo || '-'}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <div className="bg-[var(--bg-secondary)] px-3 py-2 font-bold text-[var(--text-secondary)]">{t('splitEntryForm.total')}</div>
              <div className="px-3 py-2 text-[var(--text-primary)] bg-[var(--bg-card)] font-bold">
                ${lineTotal.toFixed(2)} <span className="font-normal text-[var(--text-muted)] text-xs ml-1">({isDebit ? t('splitEntryForm.debit') : t('splitEntryForm.credit')})</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">
              {t('splitEntryForm.amountToClear')}
            </label>
            <input
              type="number"
              required
              min="0.01"
              max={lineTotal - 0.01}
              step="0.01"
              value={amount}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-shadow text-gray-900"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>$0.00</span>
              <span>${lineTotal.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={lineTotal - 0.01}
              step="1"
              value={Number(amount) || 0}
              onChange={handleRangeChange}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1 flex items-center justify-center"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 shadow-sm flex-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('splitEntryForm.splitting') : t('splitEntryForm.confirmSplit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
