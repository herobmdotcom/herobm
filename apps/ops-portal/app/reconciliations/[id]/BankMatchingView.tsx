'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import ManualBankLineEntry from './ManualBankLineEntry';
import SlideOver from '@/components/shared/SlideOver';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import MatchDetailsModal from './MatchDetailsModal';
import { Button } from '@/components/shared/Button';
import { formatAmount, getErrorMessage } from '@herobm/shared';

interface UnreconciledLine {
  journalLineId: string;
  entryDate: string;
  debit: number | string;
  credit: number | string;
  memo: string;
  entryMemo?: string;
  entryNumber?: string;
  partyName?: string;
  isCleared: boolean;
}

export default function BankMatchingView({ 
  reconciliation, 
  onUpdate,
  onQuickAdjustment,
  onSplitEntry,
  onImportClick,
  refreshTrigger
}: { 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  reconciliation: Record<string, any>, 
  onUpdate: () => void,
  onQuickAdjustment: () => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  onSplitEntry: (line: Record<string, any>) => void,
  onImportClick: () => void,
  refreshTrigger?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [bankLines, setBankLines] = useState<Record<string, any>[]>([]);
  const [unreconciledLines, setUnreconciledLines] = useState<UnreconciledLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  
  const [selectedBankLines, setSelectedBankLines] = useState<Set<string>>(new Set());
  const [selectedJournalLines, setSelectedJournalLines] = useState<Set<string>>(new Set());
  
  const [showAllBankLines, setShowAllBankLines] = useState(false);
  const [showAllJournalLines, setShowAllJournalLines] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [matchModalGroupId, setMatchModalGroupId] = useState<string | null>(null);

  const t = useTranslations('admin.reconciliations');
  const tCommon = useTranslations('common');

  useEffect(() => {
    fetchData();
  }, [reconciliation.glAccountId, showAllBankLines, refreshTrigger]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bankRes, journalRes] = await Promise.all([
        api.bankStatementControllerGetLines({
          glAccountId: reconciliation.glAccountId,
          isReconciled: showAllBankLines ? undefined : false,
        }),
        api.reconciliationControllerGetLines(reconciliation.reconciliationId)
      ]);
      setBankLines(bankRes.data || []);
      setUnreconciledLines((journalRes.data || []) as unknown as UnreconciledLine[]);
    } catch (e) {
      toast.error('Failed to load reconciliation data: ' + getErrorMessage(e));
      reportError(e, 'FetchReconciliationData');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => formatAmount(Number(val), 'AUD');

  const sumBankLines = useMemo(() => {
    return Array.from(selectedBankLines).reduce((sum, id) => {
      const line = bankLines.find(l => l.lineId === id);
      return sum + (line ? Number(line.amount) : 0);
    }, 0);
  }, [selectedBankLines, bankLines]);

  const sumJournalLines = useMemo(() => {
    return Array.from(selectedJournalLines).reduce((sum, id) => {
      const line = unreconciledLines.find(l => l.journalLineId === id);
      if (!line) return sum;
      return sum + (Number(line.debit) - Number(line.credit));
    }, 0);
  }, [selectedJournalLines, unreconciledLines]);

  const variance = sumBankLines - sumJournalLines;
  const canMatch = selectedBankLines.size > 0 && selectedJournalLines.size > 0 && Math.abs(variance) < 0.001;

  const handleMatch = async () => {
    if (!canMatch) return;
    try {
      setMatching(true);
      await api.bankStatementControllerMatchBulk({
        bankLineIds: Array.from(selectedBankLines),
        journalLineIds: Array.from(selectedJournalLines),
        reconciliationId: reconciliation.reconciliationId
      });
      toast.success('Success');
      setSelectedBankLines(new Set());
      setSelectedJournalLines(new Set());
      await fetchData();
      onUpdate();
    } catch (e) {
      toast.error('Failed to match transactions: ' + getErrorMessage(e));
      reportError(e, 'MatchBulk');
    } finally {
      setMatching(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const onBankSelectionChanged = (rows: any[]) => {
    setSelectedBankLines(new Set(rows.map(r => r.lineId)));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const onJournalSelectionChanged = (rows: any[]) => {
    setSelectedJournalLines(new Set(rows.map(r => r.journalLineId)));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const isBankRowSelectable = (node: any) => !node.data.isReconciled;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const isJournalRowSelectable = (node: any) => !node.data.isCleared;

  const bankColumns = useMemo<ColDef[]>(() => [
    { 
      field: 'date', 
      headerName: t('date'), 
      width: 140, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      checkboxSelection: (params: any) => !params.data.isReconciled, 
      headerCheckboxSelection: true,
      cellClass: 'overflow-visible-cell',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      cellRenderer: (params: any) => {
        if (params.data.isReconciled) {
          return (
            <div className="flex items-center h-full relative cursor-pointer">
              { }
              <span className="material-symbols-outlined text-[18px] text-[var(--success)] absolute -left-[30px]">check</span>
              {params.value}
            </div>
          );
        }
        return params.value;
      }
    },
    { 
      field: 'amount', 
      headerName: t('amount'), 
      width: 140, 
      type: 'numericColumn',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      valueFormatter: (p: any) => p.value ? formatCurrency(p.value) : '' 
    },
    { 
      field: 'description', 
      headerName: t('description'), 
      flex: 1,
      wrapText: true,
      autoHeight: true,
      cellStyle: { lineHeight: '1.4', padding: '8px 16px' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      cellRenderer: (params: any) => {
        const line = params.data;
        return (
          <div className="font-medium text-[var(--text-primary)]">
            {line.description}
            {line.payee && <div className="text-xs font-normal text-[var(--text-secondary)]">{line.payee}</div>}
          </div>
        );
      }
    },
    { field: 'reference', headerName: t('reference'), width: 120 },
    { field: 'type', headerName: 'Type', width: 100 }
  ], [t]);

  const ledgerColumns = useMemo<ColDef[]>(() => [
    { 
      field: 'entryDate', 
      headerName: t('date'), 
      width: 140, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      checkboxSelection: (params: any) => !params.data.isCleared, 
      headerCheckboxSelection: true,
      cellClass: 'overflow-visible-cell',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      cellRenderer: (params: any) => {
        if (params.data.isCleared) {
          return (
            <div className="flex items-center h-full relative cursor-pointer">
              { }
              <span className="material-symbols-outlined text-[18px] text-[var(--success)] absolute -left-[30px]">check</span>
              {params.value}
            </div>
          );
        }
        return params.value;
      }
    },
    { 
      field: 'amount', 
      headerName: t('amount'), 
      width: 140, 
      type: 'numericColumn',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      valueGetter: (params: any) => Number(params.data.debit) - Number(params.data.credit),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      valueFormatter: (p: any) => formatCurrency(p.value) 
    },
    { 
      field: 'memo', 
      headerName: 'Memo', 
      flex: 1,
      wrapText: true,
      autoHeight: true,
      cellStyle: { lineHeight: '1.4', padding: '8px 16px' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      valueGetter: (params: any) => params.data.memo || params.data.entryMemo || 'Journal Entry',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      cellRenderer: (params: any) => {
        const line = params.data;
        return (
          <div className="font-medium text-[var(--text-primary)]">
            {line.memo || line.entryMemo || t('journalEntry')}
            {line.partyName && <div className="text-xs font-normal text-[var(--text-secondary)]">{line.partyName}</div>}
          </div>
        );
      }
    },
    { field: 'entryNumber', headerName: 'Entry', width: 150 }
  ], [t]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
      <div className="flex-1 flex p-4 gap-4 min-h-0">
        {/* LEFT PANE: Bank Lines */}
        <div className="w-1/2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] flex flex-col z-10 min-h-0">
          <div className="flex-1 relative [--ag-row-height:40px] [--ag-header-height:40px]">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>
            ) : (
              <DataGrid
                overlayNoRowsTemplate={`<span style="color: var(--text-muted)">${t('noLines')}</span>`}
                rowData={showAllBankLines ? bankLines : bankLines.filter(l => !l.isReconciled)}
                columns={bankColumns}
                rowIdField="lineId"
                fetchAll={true}
                rowSelection="multiple"
                onSelectionChanged={onBankSelectionChanged}
                isRowSelectable={isBankRowSelectable}
                onRowClicked={(data) => {
                  if (data && data.isReconciled && data.matchGroupId) {
                    setMatchModalGroupId(data.matchGroupId);
                  }
                }}
                gridKey="bank-matching-bank-lines"
                domLayout="normal"
                renderHeader={({ searchInput, optionsButton, rowCount }) => (
                  <div className="px-4 py-2 border-b border-[var(--border)] flex justify-between items-center bg-transparent shrink-0 gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                        {t('statement')}
                        <span className="text-[var(--text-muted)] font-normal normal-case">({rowCount})</span>
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <label className="text-sm text-[var(--text-secondary)] flex items-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showAllBankLines} 
                            onChange={e => setShowAllBankLines(e.target.checked)} 
                            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                          />
                          {t('showAllLines')}
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <style>{`
                        .options-btn-wrapper > div > button:first-child {
                          width: 32px !important;
                          height: 32px !important;
                          padding: 0 !important;
                          display: flex !important;
                          align-items: center !important;
                          justify-content: center !important;
                          border-color: var(--border) !important;
                          color: var(--text-secondary) !important;
                        }
                        .options-btn-wrapper > div > button:first-child span.material-symbols-outlined {
                          font-size: 18px !important;
                          margin: 0 !important;
                        }
                        .options-btn-wrapper > div > button:first-child span {
                          margin-right: 0 !important;
                        }
                        .search-wrapper input {
                          height: 32px !important;
                          width: 180px !important;
                          background: transparent !important;
                          border-color: var(--border) !important;
                          padding-top: 0 !important;
                          padding-bottom: 0 !important;
                          font-size: 14px !important;
                        }
                        .overflow-visible-cell .ag-cell-value {
                          overflow: visible !important;
                        }
                      `}</style>
                      <div className="flex items-center search-wrapper">
                        {searchInput}
                      </div>
                      <div className="flex items-center options-btn-wrapper relative z-50">
                        {optionsButton}
                      </div>
                      {selectedBankLines.size > 0 && (
                        <Button 
                          variant="secondary" size="sm" className="font-semibold h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={async () => {
                            if (!confirm(tCommon('confirmDelete'))) return;
                            try {
                              for (const id of Array.from(selectedBankLines)) {
                                await api.bankStatementControllerDeleteLine(id);
                              }
                              toast.success(tCommon('deleted'));
                              setSelectedBankLines(new Set());
                              fetchData();
                            } catch (e) {
                              toast.error('Failed to delete lines: ' + getErrorMessage(e));
                              reportError(e, 'DeleteLines');
                            }
                          }}
                        >
                          {tCommon('delete')}
                        </Button>
                      )}
                      <Button 
                        variant="secondary" size="sm" className="font-semibold h-8"
                        onClick={onImportClick}
                      >
                        {t('import')}
                      </Button>
                      <Button 
                        variant="secondary" size="sm" className="font-semibold h-8"
                        onClick={() => setShowManualEntry(true)}
                      >
                        {t('addLine')}
                      </Button>
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANE: Journal Lines */}
        <div className="w-1/2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] flex flex-col z-10 min-h-0">
          <div className="flex-1 relative [--ag-row-height:40px] [--ag-header-height:40px]">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>
            ) : (
              <DataGrid
                overlayNoRowsTemplate={`<span style="color: var(--text-muted)">${t('noUnmatchedLines')}</span>`}
                rowData={showAllJournalLines ? unreconciledLines : unreconciledLines.filter(l => !l.isCleared)}
                columns={ledgerColumns}
                rowIdField="journalLineId"
                fetchAll={true}
                rowSelection="multiple"
                onSelectionChanged={onJournalSelectionChanged}
                isRowSelectable={isJournalRowSelectable}
                onRowClicked={(data) => {
                  if (data && data.isCleared && data.matchGroupId) {
                    setMatchModalGroupId(data.matchGroupId);
                  }
                }}
                gridKey="bank-matching-journal-lines"
                domLayout="normal"
                renderHeader={({ searchInput, optionsButton, rowCount }) => (
                  <div className="px-4 py-2 border-b border-[var(--border)] flex justify-between items-center bg-transparent shrink-0 gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                        {t('ledger')}
                        <span className="text-[var(--text-muted)] font-normal normal-case">({rowCount})</span>
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <label className="text-sm text-[var(--text-secondary)] flex items-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showAllJournalLines} 
                            onChange={e => setShowAllJournalLines(e.target.checked)} 
                            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                          />
                          {t('showAllLines')}
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <style>{`
                        .options-btn-wrapper > div > button:first-child {
                          width: 32px !important;
                          height: 32px !important;
                          padding: 0 !important;
                          display: flex !important;
                          align-items: center !important;
                          justify-content: center !important;
                          font-size: 0 !important;
                          gap: 0 !important;
                        }
                        .options-btn-wrapper > div > button:first-child span.material-symbols-outlined {
                          font-size: 18px !important;
                          margin: 0 !important;
                        }
                        .search-wrapper input {
                          height: 32px !important;
                          padding-top: 0 !important;
                          padding-bottom: 0 !important;
                          font-size: 14px !important;
                          width: 140px !important;
                        }
                        .overflow-visible-cell .ag-cell-value {
                          overflow: visible !important;
                        }
                      `}</style>
                      <div className="flex items-center search-wrapper">
                        {searchInput}
                      </div>
                      <div className="flex items-center options-btn-wrapper relative z-50">
                        {optionsButton}
                      </div>
                      <Button
                        variant="secondary" size="sm" className="font-semibold h-8"
                        onClick={onQuickAdjustment}
                      >
                        {t('addAdjustment')}
                      </Button>
                      <Button
                        variant="secondary" size="sm" className="font-semibold h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          const id = Array.from(selectedJournalLines)[0];
                          const line = unreconciledLines.find(l => l.journalLineId === id);
                          if (line) onSplitEntry(line);
                        }}
                        disabled={selectedJournalLines.size !== 1}
                        title={selectedJournalLines.size !== 1 ? t('selectSingleRowToSplit') : ''}
                      >
                        {t('split')}
                      </Button>
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sticky Match Bar */}
      <div className="p-4 bg-[var(--bg-card)] border-t border-[var(--border)] shrink-0 z-10 flex items-center justify-between">
        <div className="flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('selectedBank')} ({selectedBankLines.size})</div>
              <div className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(sumBankLines)}</div>
            </div>
            
            <div className="text-[var(--text-muted)] flex items-center justify-center">
              { }
              <span className="material-symbols-outlined text-[24px]">compare_arrows</span>
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('selectedLedger')} ({selectedJournalLines.size})</div>
              <div className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(sumJournalLines)}</div>
            </div>

            <div className="pl-8 border-l border-gray-200">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('variance')}</div>
              <div className={`text-lg font-medium ${Math.abs(variance) < 0.001 ? 'text-[var(--success)]' : 'text-red-500'}`}>
                {formatCurrency(variance)}
              </div>
            </div>
          </div>
          
          <Button variant="primary"
            disabled={!canMatch || matching}
            onClick={handleMatch}
            className="px-8 py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {matching ? tCommon('saving') : t('match')}
          </Button>
        </div>
      </div>
      <SlideOver
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        title={t('addManualLines')}
      >
        <div className="p-4 h-full">
          <ManualBankLineEntry 
            glAccountId={reconciliation.glAccountId}
            onSuccess={() => {
              setShowManualEntry(false);
              fetchData();
            }}
            onCancel={() => setShowManualEntry(false)}
          />
        </div>
      </SlideOver>
      {matchModalGroupId && (
        <MatchDetailsModal
          isOpen={!!matchModalGroupId}
          matchGroupId={matchModalGroupId}
          reconciliationId={reconciliation.reconciliationId}
          glAccountId={reconciliation.glAccountId}
          onClose={() => setMatchModalGroupId(null)}
          onUnmatchSuccess={() => {
            setMatchModalGroupId(null);
            fetchData();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
