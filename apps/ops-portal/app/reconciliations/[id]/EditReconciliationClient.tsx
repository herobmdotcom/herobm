'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import QuickAdjustmentModal from './QuickAdjustmentModal';
import SplitEntryModal from './SplitEntryModal';
import MatchDetailsModal from './MatchDetailsModal';
import AutoMatchPreviewModal from './AutoMatchPreviewModal';
import BankImportModal from '../components/BankImportModal';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import BankMatchingView from './BankMatchingView';
import { getErrorMessage } from '@herobm/shared';

interface UnreconciledLine {
  journalLineId: string;
  entryDate: string;
  debit: number | string;
  credit: number | string;
  memo: string;
  entryMemo?: string;
  entryNumber?: string;
  partyName?: string;
  partyId?: string;
  isCleared: boolean;
}

interface ToggleCellParams extends ICellRendererParams {
  data: UnreconciledLine;
  context: {
    handleToggle: (lineId: string, isCleared: boolean) => void;
    isPosted: boolean;
  };
}

const ToggleCell = (p: ToggleCellParams) => {
  const t = useTranslations('gl.reconciliations');
  const data = p.data;
  const context = p.context;
  
  if (!data || !context) return null;
  const { handleToggle, isPosted } = context;

  const handleToggleClick = () => {
    handleToggle(data.journalLineId, !data.isCleared);
  };

  return (
    <div className="flex items-center gap-3 mt-1">
      <Button variant="ghost"
        type="button"
        disabled={isPosted}
        onClick={handleToggleClick}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
 data.isCleared ? 'bg-[var(--accent)]' : 'bg-gray-300'
 } ${isPosted ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-checked={data.isCleared}
        role="switch"
        title={data.isCleared ? t('tooltips.clickToUnclear') : t('tooltips.clickToClear')}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
 data.isCleared ? 'translate-x-4' : 'translate-x-0'
 }`}
        />
      </Button>
    </div>
  );
};

export default function EditReconciliationClient({ id }: { id: string }) {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('detailsTitle'));
  const router = useRouter();
  
  const [reconciliation, setReconciliation] = useState<api.ReconciliationDetailResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [isSplitModalOpen, setSplitModalOpen] = useState(false);
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<api.AutoMatchResponseDto | null>(null);
  const [selectedRow, setSelectedRow] = useState<UnreconciledLine | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      const recRes = await api.reconciliationControllerGetReconciliation(id);
      setReconciliation(recRes.data );
    } catch (err) {
      reportError(err, 'ReconciliationDetails');
      setFetchError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleToggle = async (lineId: string, isCleared: boolean, amount?: number) => {
    try {
      await api.reconciliationControllerToggleLine(id, lineId, { isCleared, amount });
      // Refresh details to update variance and lines
      fetchDetails();
      setRefreshKey(k => k + 1);
      
      if (selectedRow && selectedRow.journalLineId === lineId) {
        setSelectedRow({ ...selectedRow, isCleared });
      }
    } catch (err) {
      reportError(err, 'ReconciliationToggle');
      toast.error(t('toggleError'));
    }
  };

  const handlePost = async () => {
    if (!confirm(t('confirmPost'))) return;
    
    setPosting(true);
    try {
      await api.reconciliationControllerPostReconciliation(id, {});
      toast.success(t('postSuccess'));
      router.push('/reconciliations');
    } catch (err) {
      reportError(err, 'ReconciliationPost');
      toast.error(t('postError'));
    } finally {
      setPosting(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirm(t('confirmDiscard'))) return;
    
    setPosting(true);
    try {
      await api.reconciliationControllerDiscardReconciliation(id);
      toast.success(t('discardSuccess'));
      router.push('/reconciliations');
    } catch (err: unknown) {
      reportError(err, 'ReconciliationDiscard');
      toast.error(getErrorMessage(err) || t('discardError'));
      setPosting(false);
    }
  };

  const columns = useMemo<ColDef[]>(() => {
    const isPosted = reconciliation?.status === 'posted';
    
    return [
      { 
        field: 'entryDate', 
        headerName: t('columns.date'), 
        width: 140,
        comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
          if (valueA === valueB) {
            // If dates are identical, fallback to a strict logic:
            // 1. Keep children after their parents by comparing sourceId
            if (nodeA.data?.sourceId === nodeB.data?.journalLineId) return isDescending ? -1 : 1;
            if (nodeB.data?.sourceId === nodeA.data?.journalLineId) return isDescending ? 1 : -1;
            
            // 2. If they are siblings (same sourceId), sort by Memo (Reversal, Split A, Split B)
            if (nodeA.data?.sourceId && nodeA.data?.sourceId === nodeB.data?.sourceId) {
              const memoA = nodeA.data.memo || '';
              const memoB = nodeB.data.memo || '';
              
              const getRank = (m: string) => {
                if (m.startsWith('Reversal')) return 1;
                if (m.startsWith('Split A')) return 2;
                if (m.startsWith('Split B')) return 3;
                return 4;
              };
              
              return getRank(memoA) - getRank(memoB);
            }
            
            // 3. Fallback to createdAt or entryNumber
            return (nodeA.data?.entryNumber || '').localeCompare(nodeB.data?.entryNumber || '');
          }
          return (valueA || '').localeCompare(valueB || '');
        }
      },
      { field: 'entryNumber', headerName: t('columns.entryNo'), width: 150 },
      { 
        field: 'partyName', 
        headerName: t('columns.party'), 
        width: 150,
        valueGetter: (p: ValueGetterParams<UnreconciledLine>) => p.data?.partyName || p.data?.partyId || ''
      },
      { field: 'memo', headerName: t('columns.memo'), flex: 1 },
      { 
        field: 'debit', 
        headerName: t('columns.debit'), 
        width: 120,
        valueFormatter: (p) => p.value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(p.value) : ''
      },
      { 
        field: 'credit', 
        headerName: t('columns.credit'), 
        width: 120,
        valueFormatter: (p) => p.value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(p.value) : ''
      },
      {
        headerName: t('columns.cleared'),
        cellRenderer: ToggleCell,
        width: 100,
        suppressSizeToFit: true,
        sortable: false,
        filter: false,
      }
    ];
  }, [reconciliation?.status, t]);

  if (loading) return <div className="p-4">{t('loading')}</div>;
   
  if (fetchError) return <div className="p-4 text-red-500">Error: {fetchError}</div>;
  if (!reconciliation) return <div className="p-4">{t('notFound')}</div>;

  const isPosted = reconciliation.status === 'posted';
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* GLOBAL HEADER (Outside of specific views) */}
      <div className="flex flex-col bg-white border-b border-gray-200 px-6 py-4 gap-4 shrink-0 z-10 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="secondary" 
              onClick={() => router.back()} 
              className="btn btn-secondary btn-sm"
              aria-label="Go back"
              title={t('tooltips.back')}
            >
              ←
            </Button>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {t('reconciliationLabel', { glAccount: reconciliation.accountName })}
            </h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
 isPosted 
 ? 'bg-emerald-50 text-[var(--success)] border-emerald-200' 
 : 'bg-amber-50 text-[var(--warning)] border-amber-200'
 }`}>
              {isPosted ? tCommon('states.posted') : tCommon('states.draft')}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isPosted && (
              <>
                <Button variant="secondary"
                  onClick={async () => {
                    try {
                      setPosting(true);
                      const res = await api.bankStatementControllerAutoMatch({ 
                        glAccountId: reconciliation.glAccountId,
                        reconciliationId: reconciliation.reconciliationId,
                        dryRun: true,
                      });
                      const data = res.data;
                      if (data.autoMatchedCount > 0 || data.smartMatchedCount > 0) {
                        setPreviewData(data);
                        setPreviewModalOpen(true);
                      } else {
                        toast('No matches found.', { icon: 'ℹ️' });
                      }
                    } catch (e) {
                      reportError(e, 'AutoMatchPreview');
                    } finally {
                      setPosting(false);
                    }
                  }}
                  disabled={posting || loading}
                  className="btn btn-secondary font-semibold text-sm h-8 flex items-center gap-2"
                >
                  {t('autoMatch')}
                </Button>
                <Button variant="secondary"
                  onClick={handleDiscard}
                  disabled={posting}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {t('discard')}
                </Button>
                <Button variant="primary"
                  onClick={handlePost}
                  disabled={posting || Math.abs(reconciliation.variance) > 0.001}
                  className="px-5 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title={Math.abs(reconciliation.variance) > 0.001 ? t('varianceMustBeZero') : ''}
                >
                  {posting ? t('posting') : t('postReconciliation')}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-1 text-sm text-gray-600">
          <span>{t('statementDateLabel', { date: reconciliation.statementDate })}</span>
          <div className="flex items-center gap-2">
            <span>{t('opening')}:</span>
            <span>{formatCurrency(reconciliation.openingBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{t('cleared')}:</span>
            <span>{formatCurrency(reconciliation.clearedBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{t('statement')}:</span>
            <span>{formatCurrency(reconciliation.statementBalance)}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
            <span>{t('variance')}:</span>
            <span className={`${Math.abs(reconciliation.variance) < 0.001 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
              {formatCurrency(reconciliation.variance)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-gray-50 relative">
        <BankMatchingView 
          refreshTrigger={refreshKey}
          reconciliation={reconciliation} 
          onUpdate={() => { fetchDetails(); setRefreshKey(k => k + 1); }} 
          onQuickAdjustment={() => setAdjustmentModalOpen(true)}
          onSplitEntry={(line) => { setSelectedRow(line as unknown as UnreconciledLine); setSplitModalOpen(true); }}
          onImportClick={() => setIsImportModalOpen(true)}
        />
      </div>
      <QuickAdjustmentModal 
        isOpen={isAdjustmentModalOpen} 
        onClose={() => setAdjustmentModalOpen(false)} 
        reconciliationId={id} 
        onSuccess={() => {
          fetchDetails();
          setRefreshKey(k => k + 1);
        }}
      />
      <SplitEntryModal
        isOpen={isSplitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        reconciliationId={id}
        selectedLine={selectedRow!}
        onSuccess={() => {
          fetchDetails();
          setRefreshKey(k => k + 1);
          setSelectedRow(null); // Clear selection after split
        }}
      />
      <AutoMatchPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        previewData={previewData}
        glAccountId={reconciliation.glAccountId}
        reconciliationId={id}
        onConfirmSuccess={() => {
          fetchDetails();
          setRefreshKey(k => k + 1);
        }}
      />
      <BankImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          fetchDetails();
          setRefreshKey(k => k + 1);
        }}
        fixedGlAccountId={reconciliation.glAccountId}
      />
    </div>
  );
}
