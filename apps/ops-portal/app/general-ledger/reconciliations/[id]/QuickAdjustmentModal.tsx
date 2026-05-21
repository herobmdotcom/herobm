import React, { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { apiFetch, reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { getCurrency } from '@/lib/currency';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface QuickAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationId: string;
  onSuccess: () => void;
}

export default function QuickAdjustmentModal({
  isOpen,
  onClose,
  reconciliationId,
  onSuccess
}: QuickAdjustmentModalProps) {
  const { baseCurrency } = useSettings();
  const currencySymbol = getCurrency(baseCurrency)?.symbol || '$';
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'debit' | 'credit'>('credit'); // default to credit (Money Out / Bank Fee)
  const [amount, setAmount] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (isOpen && accounts.length === 0) {
      apiFetch<any>('/api/gl/accounts')
        .then(res => setAccounts(res.data || res))
        .catch(err => reportError(err, 'QuickAdjustmentModal_loadAccounts'));
    }
  }, [isOpen, accounts.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offsetAccountId || !amount || !memo || !date) {
      toast.error(t('quickAdjustmentForm.requiredFieldsError'));
      return;
    }

    setLoading(true);
    try {
      await apiFetch(`/api/gl/reconciliations/${reconciliationId}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          amount: Number(amount),
          type,
          offsetAccountId,
          memo
        })
      });
      onSuccess();
      onClose();
      // Reset form
      setAmount('');
      setMemo('');
    } catch (err: any) {
      reportError(err, 'QuickAdjustmentModal_submit');
      toast.error(err.message || t('quickAdjustmentForm.failedToCreateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('quickAdjustmentForm.title')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{t('quickAdjustmentForm.date')}</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{t('quickAdjustmentForm.type')}</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'debit' | 'credit')}
              className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="credit">{t('quickAdjustmentForm.moneyOut')}</option>
              <option value="debit">{t('quickAdjustmentForm.moneyIn')}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">{t('quickAdjustmentForm.amount')}</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] text-sm">{currencySymbol}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="border border-[var(--border)] rounded pl-7 pr-3 py-2 text-sm w-full bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">{t('quickAdjustmentForm.offsetAccount')}</label>
          <select
            required
            value={offsetAccountId}
            onChange={e => setOffsetAccountId(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="" disabled>{t('quickAdjustmentForm.selectAccount')}</option>
            {accounts.filter(a => !a.isGroup).map(a => (
              <option key={a.glAccountId} value={a.glAccountId}>
                {a.accountCode} - {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">{t('quickAdjustmentForm.memo')}</label>
          <input
            type="text"
            required
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder={t('quickAdjustmentForm.memoPlaceholder')}
          />
        </div>

        <div className="mt-4 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] rounded transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:brightness-110 rounded transition-all disabled:opacity-50"
          >
            {loading ? t('quickAdjustmentForm.creating') : t('quickAdjustmentForm.createAndReconcile')}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
