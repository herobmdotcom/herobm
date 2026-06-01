'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiFetch, apiMutate } from '@/lib/api';

export default function RulesEnginePage() {
  const t = useTranslations('gl.reconciliations');
  useDocumentTitle('Reconciliation Rules');

  const [rules, setRules] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  
  // new rule state
  const [bankAccountId, setBankAccountId] = useState('');
  const [conditionType, setConditionType] = useState('contains');
  const [conditionValue, setConditionValue] = useState('');
  const [targetGlAccountId, setTargetGlAccountId] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const accs = await apiFetch<any>('/api/gl/accounts?limit=1000');
      setGlAccounts(accs.items || []);
      const r = await apiFetch<any[]>('/api/gl/bank-feeds/rules');
      setRules(r);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!conditionValue || !targetGlAccountId) return;
    setLoading(true);
    try {
      await apiMutate('/api/gl/bank-feeds/rules', 'POST', {
        glAccountId: bankAccountId || undefined,
        conditionType,
        conditionValue,
        targetGlAccountId,
        priority: 10
      });
      setConditionValue('');
      setTargetGlAccountId('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const bankAccs = glAccounts.filter(a => a.isBankAccount);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] p-6 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reconciliation Rules</h1>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Create New Rule</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Bank Account (Optional)</label>
              <select 
                className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
              >
                <option value="">All Bank Accounts</option>
                {bankAccs.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Target GL Account (Tag to)</label>
              <select 
                className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                value={targetGlAccountId}
                onChange={e => setTargetGlAccountId(e.target.value)}
              >
                <option value="">Select Account...</option>
                {glAccounts.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Condition Type</label>
              <select 
                className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                value={conditionType}
                onChange={e => setConditionType(e.target.value)}
              >
                <option value="contains">Description Contains</option>
                <option value="starts_with">Description Starts With</option>
                <option value="exact_match">Description Exact Match</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Condition Value</label>
              <input 
                type="text" 
                placeholder="e.g. STRIPE PAYOUT"
                className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                value={conditionValue}
                onChange={e => setConditionValue(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleCreate}
              disabled={loading || !conditionValue || !targetGlAccountId}
              className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded hover:brightness-110 disabled:opacity-50"
            >
              Add Rule
            </button>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Bank Account</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Target GL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rules.map(rule => {
                const bank = bankAccs.find(a => a.glAccountId === rule.glAccountId);
                const target = glAccounts.find(a => a.glAccountId === rule.targetGlAccountId);
                return (
                  <tr key={rule.ruleId} className="hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-primary)]">
                    <td className="px-4 py-3">{bank ? bank.name : 'All Accounts'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-0.5 rounded text-xs mr-2">
                        {rule.conditionType}
                      </span>
                      {rule.conditionValue}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--brand-blue)]">
                      {target ? `${target.accountCode} - ${target.name}` : rule.targetGlAccountId}
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No rules defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
