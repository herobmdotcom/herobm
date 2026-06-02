'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';

export default function NewReconciliationPage() {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('newReconciliation'));
  const router = useRouter();
  
  const [glAccountId, setGlAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await api.glControllerGetAccounts({});
        setAccounts(res.data);
      } catch (err) {
        reportError(err, 'NewReconciliationFetchAccounts');
      }
    }
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.reconciliationControllerCreateReconciliation({
        glAccountId,
        statementDate,
        statementBalance: Number(statementBalance),
        createdBy: 'System User', // Hardcoded for now
      });
      const data = res.data;
      
      router.push(`/general-ledger/reconciliations/${data.reconciliationId}`);
    } catch (err) {
      reportError(err, 'NewReconciliationSubmit');
      alert(t('createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">{t('newReconciliation')}</h1>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('glAccount')}
            </label>
            <select
              value={glAccountId}
              onChange={(e) => setGlAccountId(e.target.value)}
              required
              className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
            >
              <option value="">{t('selectAccount')}</option>
              {Array.isArray(accounts) && accounts.map(acc => (
                <option key={acc.glAccountId} value={acc.glAccountId}>
                  {acc.accountCode} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('statementDate')}
            </label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              required
              className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('statementBalance')}
            </label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              required
              className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md shadow-sm hover:bg-orange-600 font-medium transition-colors text-sm disabled:opacity-50"
            >
              {loading ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
