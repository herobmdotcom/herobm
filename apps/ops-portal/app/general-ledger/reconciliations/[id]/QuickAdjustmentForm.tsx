'use client';

import React, { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { getCurrency } from '@/lib/currency';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';

interface QuickAdjustmentFormProps {
  reconciliationId: string;
  onSuccess: (journalLineId?: string) => void;
  // modbm-allow-record-any
  bankLine?: Record<string, any>;
}

export default function QuickAdjustmentForm({
  reconciliationId,
  onSuccess,
  bankLine
}: QuickAdjustmentFormProps) {
  const { baseCurrency } = useSettings();
  const currencySymbol = getCurrency(baseCurrency)?.symbol || '$';
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<api.GlAccountResponseDto[]>([]);
  
  const initialDate: string = (bankLine?.date as string) || new Date().toISOString().split('T')[0];
  const initialAmount: string = bankLine ? Math.abs(bankLine.amount as number).toString() : '';
  const initialType: 'debit' | 'credit' = bankLine ? ((bankLine.amount as number) > 0 ? 'debit' : 'credit') : 'credit';
  const initialMemo: string = (bankLine?.description as string) || '';

  const [date, setDate] = useState<string>(initialDate);
  const [type, setType] = useState<'debit' | 'credit'>(initialType);
  const [amount, setAmount] = useState<string>(initialAmount);
  const [offsetAccountId, setOffsetAccountId] = useState<string>('');
  const [memo, setMemo] = useState<string>(initialMemo);

  useEffect(() => {
    if (accounts.length === 0) {
      api.glControllerGetAccounts({})
        .then(res => setAccounts((res.data)))
        .catch(err => reportError(err, 'QuickAdjustmentForm_loadAccounts'));
    }
  }, [accounts.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offsetAccountId || !amount || !memo || !date) {
      toast.error(t('quickAdjustmentForm.requiredFieldsError'));
      return;
    }

    setLoading(true);
    try {
      const res = await api.reconciliationControllerCreateAdjustment(reconciliationId, {
        date,
        amount: Number(amount),
        type: type as any,
        offsetAccountId,
        memo
      });
      onSuccess((res.data as any)?.journalLineId);
      // Reset form if not prefilled
      if (!bankLine) {
        setAmount('');
        setMemo('');
      }
    } catch (err: unknown) {
      reportError(err, 'QuickAdjustmentForm_submit');
      toast.error(getErrorMessage(err) || t('quickAdjustmentForm.failedToCreateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbol}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="border border-[var(--border)] rounded pl-8 pr-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] w-full"
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
          <option value="">{t('quickAdjustmentForm.selectAccount')}</option>
          {accounts.map(acc => (
            <option key={acc.glAccountId} value={acc.glAccountId}>
              {acc.accountCode} - {acc.name}
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

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full btn btn-primary flex justify-center py-2.5 disabled:opacity-50"
      >
        {loading ? tCommon('saving') : tCommon('save')}
      </button>
    </form>
  );
}
