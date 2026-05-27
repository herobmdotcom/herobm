'use client';

import React, { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import QuickAdjustmentModal from './QuickAdjustmentModal';
import SplitEntryModal from './SplitEntryModal';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

const ToggleCell = (p: any) => {
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
      <button
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
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            data.isCleared ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export default function ReconciliationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('detailsTitle'));
  const router = useRouter();
  
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [isSplitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const fetchDetails = useCallback(async () => {
    try {
      const recRes = await api.reconciliationControllerGetReconciliation(id);
      setReconciliation(recRes.data as any);
    } catch (err) {
      reportError(err, 'ReconciliationDetails');
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
      await api.reconciliationControllerPostReconciliation(id);
      toast.success(t('postSuccess'));
      router.push('/general-ledger/reconciliations');
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
      router.push('/general-ledger/reconciliations');
    } catch (err: any) {
      reportError(err, 'ReconciliationDiscard');
      toast.error(err.message || t('discardError'));
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
        valueGetter: (p: any) => p.data?.partyName || p.data?.partyId || ''
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
  if (!reconciliation) return <div className="p-4">{t('notFound')}</div>;

  const isPosted = reconciliation.status === 'posted';
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 min-h-0 flex flex-col">
        <DataGrid
          refreshTrigger={refreshKey}
          endpoint={`/api/gl/reconciliations/${id}/unreconciled`}
          columns={columns}
          rowIdField="journalLineId"
          fetchAll={true}
          rowSelection="single"
          onSelectionChanged={(rows) => setSelectedRow(rows[0] || null)}
          context={{ handleToggle, isPosted }}
          renderHeader={({ searchInput, optionsButton, rowCount, loading: gridLoading }) => (
            <div className="flex flex-col bg-white border-b border-gray-200">
              <div className="flex flex-col px-6 py-4 gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => router.back()} 
                      className="btn btn-secondary btn-sm"
                      aria-label="Go back"
                      title={t('tooltips.back')}
                    >
                      ←
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                      {t('reconciliationLabel', { account: reconciliation.accountName })}
                    </h1>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isPosted 
                        ? 'bg-emerald-50 text-[var(--success)] border-emerald-200' 
                        : 'bg-amber-50 text-[var(--warning)] border-amber-200'
                    }`}>
                      {isPosted ? tCommon('states.posted') : tCommon('states.draft')}
                    </span>
                    <span className="text-sm text-gray-500 font-medium ml-2">
                      {t('statementDateLabel', { date: reconciliation.statementDate })}
                    </span>
                    <div className="flex items-center bg-[#f0f8f6] rounded px-2 py-0.5 ml-2">
                      <span className="text-[10px] font-bold text-[#006b5c] uppercase tracking-wider mr-1.5">{t('rows')}</span>
                      <span className="text-[11px] font-bold text-[#006b5c]">
                        {gridLoading ? '...' : rowCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!isPosted && (
                      <>
                        <button
                          onClick={handleDiscard}
                          disabled={posting}
                          className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('discard')}
                        </button>
                        <button
                          onClick={handlePost}
                          disabled={posting || Math.abs(reconciliation.variance) > 0.001}
                          className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          title={Math.abs(reconciliation.variance) > 0.001 ? t('varianceMustBeZero') : ''}
                        >
                          {posting ? t('posting') : t('postReconciliation')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('openingBalance')}</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.openingBalance)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('clearedBalance')}</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.clearedBalance)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('statementBalance')}</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.statementBalance)}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${Math.abs(reconciliation.variance) < 0.001 ? 'bg-[#f0f8f6] border-[#006b5c]/30' : 'bg-red-50 border-red-200'}`}>
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${Math.abs(reconciliation.variance) < 0.001 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
                      {t('variance')}
                    </div>
                    <div className={`text-xl font-bold mt-0.5 ${Math.abs(reconciliation.variance) < 0.001 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
                      {formatCurrency(reconciliation.variance)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1 max-w-sm">
                    {searchInput}
                  </div>
                  {!isPosted && (
                    <>
                      <button
                        onClick={() => setAdjustmentModalOpen(true)}
                        className="btn btn-secondary btn-sm flex items-center gap-2"
                      >
                        {/* eslint-disable i18next/no-literal-string */}
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        {/* eslint-enable i18next/no-literal-string */}
                        {t('quickAdjustment')}
                      </button>
                      <button
                        onClick={() => setSplitModalOpen(true)}
                        disabled={!selectedRow || selectedRow.isCleared}
                        className="btn btn-secondary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!selectedRow ? t('tooltips.selectRowToSplit') : selectedRow.isCleared ? t('tooltips.splitRowDisabled') : ''}
                      >
                        {/* eslint-disable i18next/no-literal-string */}
                        <span className="material-symbols-outlined text-[18px]">call_split</span>
                        {/* eslint-enable i18next/no-literal-string */}
                        {t('splitEntry')}
                      </button>
                    </>
                  )}
                  {optionsButton}
                </div>
              </div>
            </div>
          )}
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
        selectedLine={selectedRow}
        onSuccess={() => {
          fetchDetails();
          setRefreshKey(k => k + 1);
          setSelectedRow(null); // Clear selection after split
        }}
      />
    </div>
  );
}
