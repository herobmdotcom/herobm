/* eslint-disable i18next/no-literal-string */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiFetch } from '@/lib/api';

export default function NewReconciliationPage() {
  useDocumentTitle('New Bank Reconciliation');
  const router = useRouter();
  
  const [glAccountId, setGlAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const data = await apiFetch<any>('/api/gl/accounts');
        setAccounts(data.data || data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/gl/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glAccountId,
          statementDate,
          statementBalance: Number(statementBalance),
          createdBy: 'System User', // Hardcoded for now
        })
      });
      
      router.push(`/general-ledger/reconciliations/${data.reconciliationId}`);
    } catch (err) {
      console.error(err);
      alert('Error creating reconciliation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">New Bank Reconciliation</h1>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Account
            </label>
            <select
              value={glAccountId}
              onChange={(e) => setGlAccountId(e.target.value)}
              required
              className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
            >
              <option value="">Select Account...</option>
              {Array.isArray(accounts) && accounts.map(acc => (
                <option key={acc.glAccountId} value={acc.glAccountId}>
                  {acc.accountCode} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Statement Date
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
              Statement Balance
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md shadow-sm hover:bg-orange-600 font-medium transition-colors text-sm disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Start Reconciling'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
