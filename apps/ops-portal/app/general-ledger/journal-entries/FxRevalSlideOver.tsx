'use client';

import React, { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

interface FxRevalSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CandidateLine {
  accountId?: string;
  debit: number;
  credit: number;
  foreignDebit?: number;
  foreignCredit?: number;
  foreignCurrencyCode?: string;
  exchangeRate?: number;
  partyType?: 'customer' | 'supplier' | null;
  partyId?: string | null;
  memo?: string;
}

export default function FxRevalSlideOver({ isOpen, onClose, onSuccess }: FxRevalSlideOverProps) {
  const t = useTranslations('common');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [revaluationDate, setRevaluationDate] = useState(() => {
    const today = new Date();
    // Default to last day of previous month
    today.setDate(0);
    return today.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateLine[]>([]);
  const [accounts, setAccounts] = useState<Record<string, { code: string; name: string }>>({});
  const [baseCurrency, setBaseCurrency] = useState('GBP');

  useEffect(() => {
    // Fetch accounts and settings once on mount
    const fetchMetadata = async () => {
      try {
        const [accRes, setRes] = await Promise.all([
          api.glControllerGetAccounts(),
          api.glControllerGetSettings()
        ]);
        
        const accountsMap: Record<string, { code: string; name: string }> = {};
        const accList = Array.isArray(accRes.data) ? accRes.data : ((accRes.data as { data?: unknown[] }).data || []);
        accList.forEach((acc: unknown) => {
          const account = acc as { glAccountId?: string; id: string; accountCode: string; name: string };
          accountsMap[account.glAccountId || account.id] = { code: account.accountCode, name: account.name };
        });
        setAccounts(accountsMap);
        
        const settings = setRes.data as { baseCurrency?: string };
        if (settings.baseCurrency) {
          setBaseCurrency(settings.baseCurrency);
        }
      } catch (e) {
        toast.error('Failed to load accounts: ' + getErrorMessage(e));
        reportError(e, 'FxRevalSlideOver');
      }
    };
    fetchMetadata();
  }, []);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setHasGenerated(false);
      setCandidates([]);
      setLoading(false);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!revaluationDate) {
      toast.error('Please select a revaluation date.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.glControllerGetFxCandidates({ revaluationDate });
      const data = res.data as unknown as { candidates: CandidateLine[] };
      setCandidates(data.candidates || []);
      setHasGenerated(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'FxRevalSlideOver');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!window.confirm('Post journal entries to the General Ledger?')) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.glControllerCommitFxRevaluation({
        revaluationDate,
        lines: candidates as never,
      });
      const data = res.data as unknown as { entriesGenerated: number };
      
      toast.success(`Successfully posted FX Revaluation (${data.entriesGenerated} lines generated)`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'FxRevalSlideOver');
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = candidates.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = candidates.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (index: number, field: 'debit' | 'credit', value: string) => {
    const num = parseFloat(value) || 0;
    const newCandidates = [...candidates];
    newCandidates[index] = { ...newCandidates[index], [field]: num };
    setCandidates(newCandidates);
  };

  const generateBtnText = loading ? 'Generating...' : 'Generate Candidates';
  const postBtnText = loading ? 'Posting...' : 'Post Revaluation';

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Period-End FX Revaluation"
      width="max-w-[66vw]"
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                Revaluation Date
              </label>
              <input
                type="date"
                value={revaluationDate}
                onChange={(e) => {
                  setRevaluationDate(e.target.value);
                  setHasGenerated(false); // Reset if date changes
                }}
                className="input w-48"
              />
            </div>
            <Button 
              variant="primary"
              onClick={handleGenerate} 
              disabled={loading || !revaluationDate}
            >
              {generateBtnText}
            </Button>
          </div>
        </div>

        {hasGenerated && (
          <div className="space-y-4">

            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-primary)] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-[150px]">Account</th>
                    <th className="px-4 py-3 min-w-[200px]">Memo</th>
                    <th className="px-4 py-3 w-[140px] text-right">Original Amount</th>
                    <th className="px-4 py-3 w-[120px] text-right">Exchange Rate</th>
                    <th className="px-4 py-3 text-right w-[140px]">Debit ({baseCurrency})</th>
                    <th className="px-4 py-3 text-right w-[140px]">Credit ({baseCurrency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)] italic">
                        No eligible candidates
                      </td>
                    </tr>
                  ) : candidates.map((line, idx) => {
                    const acc = line.accountId ? accounts[line.accountId] : null;
                    const accountCodeDisplay = acc ? acc.code : (line.accountId?.substring(0, 8) + '...');
                    const accountNameDisplay = acc ? acc.name : '';
                    
                    const origAmount = line.foreignDebit ? line.foreignDebit : (line.foreignCredit ? line.foreignCredit : 0);
                    const origDisplay = origAmount ? `${origAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${line.foreignCurrencyCode || ''}` : '-';
                    const fxRateDisplay = line.exchangeRate ? line.exchangeRate.toFixed(4) : '-';

                    return (
                    <tr key={idx} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-4 py-2 font-mono text-xs text-[var(--text-primary)]" title={accountNameDisplay}>
                        <span className="border-b border-dashed border-[var(--border)] cursor-help">{accountCodeDisplay}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--text-primary)]">
                        {line.memo}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-right text-[var(--text-muted)]">
                        {origDisplay}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-right text-[var(--text-muted)]">
                        {fxRateDisplay}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                          className="input input-sm w-28 text-right font-mono"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                          className="input input-sm w-28 text-right font-mono"
                        />
                      </td>
                    </tr>
                    );
                  })}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                        No variances found to revalue.
                      </td>
                    </tr>
                  )}
                  {candidates.length > 0 && (
                    <tr className="bg-[var(--bg-secondary)] border-t-2 border-[var(--border)]">
                      <td colSpan={4} className="px-4 py-3 text-right font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
                        Total
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${!isBalanced ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
                        {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${!isBalanced ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
                        {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-6 flex justify-end items-center">
              <Button 
                variant="primary"
                onClick={handleCommit} 
                disabled={loading || !isBalanced || candidates.length === 0}
              >
                {postBtnText}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
