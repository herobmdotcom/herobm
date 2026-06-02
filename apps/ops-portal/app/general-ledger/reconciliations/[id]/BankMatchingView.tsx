'use client';

import React, { useState, useEffect } from 'react';
import MasterDetailLayout from '@/components/shared/MasterDetailLayout';
import * as api from '@modbm/sdk';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import QuickAdjustmentForm from './QuickAdjustmentForm';

interface UnreconciledLine {
  journalLineId: string;
  entryDate: string;
  debit: number | string;
  credit: number | string;
  memo: string;
}

export default function BankMatchingView({ 
  reconciliation, 
  onUpdate 
}: { 
  reconciliation: any, 
  onUpdate: () => void 
}) {
  const [bankLines, setBankLines] = useState<api.BankStatementLineDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'find' | 'create'>('find');
  const [unreconciledLines, setUnreconciledLines] = useState<UnreconciledLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [matchSelectedLineId, setMatchSelectedLineId] = useState<string | null>(null);
  const t = useTranslations('admin.reconciliations');
  const tCommon = useTranslations('common');

  useEffect(() => {
    fetchBankLines();
    fetchUnreconciledLines();
  }, [reconciliation.glAccountId]);

  const fetchBankLines = async () => {
    try {
      setLoading(true);
      const res = await api.bankStatementControllerGetLines({
        glAccountId: reconciliation.glAccountId,
        isReconciled: false,
      });
      setBankLines(res.data || []);
    } catch (e) {
      reportError(e, 'BankLines');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreconciledLines = async () => {
    try {
      setLoadingLines(true);
      const res = await api.reconciliationControllerGetLines(reconciliation.reconciliationId);
      setUnreconciledLines((res.data || []) as unknown as UnreconciledLine[]);
    } catch (e) {
      reportError(e, 'UnreconciledLines');
    } finally {
      setLoadingLines(false);
    }
  };

  const confirmMatch = async (lineId: string) => {
    try {
      setConfirming(true);
      await api.bankStatementControllerConfirmMatch(lineId, {
        reconciliationId: reconciliation.reconciliationId,
      });
      toast.success('Match confirmed');
      await fetchBankLines();
      await fetchUnreconciledLines();
      onUpdate();
      if (selectedLineId === lineId) setSelectedLineId(null);
    } catch (e) {
      reportError(e, 'ConfirmMatch');
      toast.error(t('matchConfirmError'));
    } finally {
      setConfirming(false);
    }
  };

  const manualMatch = async (bankLineId: string, journalLineId: string) => {
    try {
      setConfirming(true);
      await api.bankStatementControllerManualMatch(bankLineId, {
        journalLineId,
        reconciliationId: reconciliation.reconciliationId,
      });
      toast.success('Match confirmed');
      await fetchBankLines();
      await fetchUnreconciledLines();
      onUpdate();
      if (selectedLineId === bankLineId) setSelectedLineId(null);
      setMatchSelectedLineId(null);
    } catch (e) {
      reportError(e, 'ManualMatch');
      toast.error(t('matchConfirmError'));
    } finally {
      setConfirming(false);
    }
  };

  const selectedLine = bankLines.find(l => l.lineId === selectedLineId);
  const formatCurrency = (val: number | string) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(val));

  const masterPane = (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--bg-primary)]">
      {loading ? (
        <div className="p-8 text-center text-[var(--text-secondary)]">{tCommon('loading')}</div>
      ) : bankLines.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center justify-center h-full">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined text-4xl text-[var(--text-muted)] mb-3">check_circle</span>
          <p className="text-[var(--text-secondary)] font-medium">{t('allLinesMatched')}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {bankLines.map(line => {
            const isSuggested = !!line.matchedJournalLineId;
            const isSelected = selectedLineId === line.lineId;
            const isDeposit = Number(line.amount) > 0;
            
            return (
              <div 
                key={line.lineId}
                onClick={() => setSelectedLineId(line.lineId)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-[#f8fbfd] border-l-4 border-l-[var(--brand-blue)]' 
                    : 'hover:bg-[var(--bg-card-hover)] border-l-4 border-l-transparent bg-[var(--bg-card)]'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{line.date}</span>
                  <span className={`text-sm font-bold ${isDeposit ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>
                    {formatCurrency(line.amount)}
                  </span>
                </div>
                <div className="text-sm text-[var(--text-primary)] font-medium line-clamp-2 mb-3 leading-snug">
                  {line.description}
                </div>
                
                {isSuggested ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-[var(--success)] border border-emerald-200">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('suggestedMatch')}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 text-[var(--text-muted)] border border-gray-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('unmatched')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const detailPane = (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {!selectedLine ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] p-8">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined text-5xl mb-4 opacity-50">account_balance</span>
          <p className="text-sm font-medium text-center">{t('selectBankLine')}</p>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Top Half: Bank Statement Line Details */}
          <div className="p-6 bg-[var(--bg-card)] border-b border-[var(--border)] shadow-sm z-10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">{t('bankStatementLine')}</h3>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {formatCurrency(selectedLine.amount)}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">{selectedLine.date}</span>
              </div>
              {Number(selectedLine.amount) > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[var(--success)] text-xs font-bold">{t('deposit')}</span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-[var(--text-secondary)] text-xs font-bold">{t('withdrawal')}</span>
              )}
            </div>
            <div className="mt-4 p-3 bg-[#f8fbfd] rounded-lg border border-blue-100/50">
              <p className="text-sm text-[var(--brand-navy)] font-medium leading-relaxed">{selectedLine.description}</p>
            </div>
          </div>

          {/* Bottom Half: System Match or Fallback */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedLine.matchedJournalLine ? (
              <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 mb-4">
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="material-symbols-outlined text-[var(--success)]">check_circle</span>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('systemMatchFound')}</h3>
                </div>
                
                <div className="bg-white border-2 border-emerald-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none" />
                  
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('journalEntry')}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{selectedLine.matchedJournalLine.entryDate}</span>
                  </div>
                  
                  <p className="text-base font-medium text-[var(--text-primary)] mb-6 relative z-10">
                    {selectedLine.matchedJournalLine.memo || t('noMemoProvided')}
                  </p>
                  
                  <div className="flex justify-between items-end relative z-10 mb-6 pb-6 border-b border-gray-100">
                    <span className="text-sm text-[var(--text-muted)] font-medium">{t('ledgerAmount')}</span>
                    <span className="text-xl font-bold text-[var(--text-primary)]">
                      {formatCurrency(Number(selectedLine.matchedJournalLine.debit) || -Number(selectedLine.matchedJournalLine.credit))}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => confirmMatch(selectedLine.lineId)}
                    disabled={confirming}
                    className="w-full py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                    {confirming ? t('confirming') : t('confirmMatch')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">{t('reconciliationActions')}</h3>
                
                <div className="flex-1 bg-white border border-[var(--border)] rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="flex border-b border-[var(--border)] bg-gray-50/50">
                    <button 
                      onClick={() => setActiveTab('find')}
                      className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'find' 
                          ? 'border-[var(--brand-blue)] text-[var(--brand-blue)]' 
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-gray-50'
                      }`}
                    >
                      {t('findMatch')}
                    </button>
                    <button 
                      onClick={() => setActiveTab('create')}
                      className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'create' 
                          ? 'border-[var(--brand-blue)] text-[var(--brand-blue)]' 
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-gray-50'
                      }`}
                    >
                      {t('createEntry')}
                    </button>
                  </div>
                  
                  <div className="flex-1 flex flex-col min-h-0">
                    {activeTab === 'find' ? (
                      <div className="flex-1 overflow-y-auto p-4">
                        {loadingLines ? (
                          <div className="p-8 text-center text-[var(--text-secondary)]">{tCommon('loading')}</div>
                        ) : unreconciledLines.length === 0 ? (
                          <div className="p-8 text-center text-[var(--text-secondary)]">{t('noUnmatchedLines')}</div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {unreconciledLines.map(line => (
                              <div 
                                key={line.journalLineId} 
                                onClick={() => setMatchSelectedLineId(line.journalLineId)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                  matchSelectedLineId === line.journalLineId
                                    ? 'border-[var(--brand-blue)] bg-[#f8fbfd] shadow-sm'
                                    : 'border-[var(--border)] bg-white hover:border-[var(--text-muted)]'
                                }`}
                              >
                                <div className="flex justify-between mb-2">
                                  <span className="text-xs font-bold text-[var(--text-muted)]">{line.entryDate}</span>
                                  <span className="text-sm font-bold text-[var(--text-primary)]">
                                    {formatCurrency(Number(line.debit) || -Number(line.credit))}
                                  </span>
                                </div>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-3">
                                  {line.memo || t('noMemoProvided')}
                                </div>
                                {matchSelectedLineId === line.journalLineId && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); manualMatch(selectedLine.lineId, line.journalLineId); }}
                                    disabled={confirming}
                                    className="w-full py-2 bg-[var(--brand-blue)] text-white text-xs font-bold rounded hover:brightness-110 disabled:opacity-50"
                                  >
                                    {confirming ? t('confirming') : t('confirmMatch')}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 p-4 overflow-y-auto">
                        <QuickAdjustmentForm 
                          bankLine={selectedLine} 
                          reconciliationId={reconciliation.reconciliationId}
                          onSuccess={() => {
                            fetchBankLines();
                            fetchUnreconciledLines();
                            onUpdate();
                            setSelectedLineId(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full">
      <MasterDetailLayout
        title=""
        isDetailOpen={!!selectedLineId}
        onCloseDetail={() => setSelectedLineId(null)}
        masterPane={masterPane}
        detailPane={detailPane}
        masterWidthClass="lg:w-[380px] shrink-0"
      />
    </div>
  );
}
