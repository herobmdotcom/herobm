/* eslint-disable i18next/no-literal-string */
'use client';

import React, { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import QuickAdjustmentModal from './QuickAdjustmentModal';
import SplitEntryModal from './SplitEntryModal';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';

const ToggleCell = (p: any) => {
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
        title={data.isCleared ? "Click to unclear" : "Click to clear"}
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
  useDocumentTitle('Reconciliation Details');
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
      const recRes = await apiFetch<any>(`/api/gl/reconciliations/${id}`);
      setReconciliation(recRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleToggle = async (lineId: string, isCleared: boolean, amount?: number) => {
    try {
      await apiFetch(`/api/gl/reconciliations/${id}/lines/${lineId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCleared, amount })
      });
      // Refresh details to update variance and lines
      fetchDetails();
      setRefreshKey(k => k + 1);
      
      if (selectedRow && selectedRow.journalLineId === lineId) {
        setSelectedRow({ ...selectedRow, isCleared });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle line');
    }
  };

  const handlePost = async () => {
    if (!confirm('Are you sure you want to post this reconciliation? This cannot be undone.')) return;
    
    setPosting(true);
    try {
      await apiFetch(`/api/gl/reconciliations/${id}/post`, {
        method: 'POST'
      });
      toast.success('Reconciliation posted successfully');
      router.push('/general-ledger/reconciliations');
    } catch (err) {
      console.error(err);
      toast.error('Failed to post reconciliation');
    } finally {
      setPosting(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirm('Are you sure you want to discard this draft reconciliation? This will un-clear all related lines and delete the draft.')) return;
    
    setPosting(true);
    try {
      await apiFetch(`/api/gl/reconciliations/${id}`, {
        method: 'DELETE'
      });
      toast.success('Reconciliation discarded successfully');
      router.push('/general-ledger/reconciliations');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to discard reconciliation');
      setPosting(false);
    }
  };

  const columns = useMemo<ColDef[]>(() => {
    const isPosted = reconciliation?.status === 'posted';
    
    return [
      { 
        field: 'entryDate', 
        headerName: 'Date', 
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
      { field: 'entryNumber', headerName: 'Entry No.', width: 150 },
      { 
        field: 'partyName', 
        headerName: 'Party', 
        width: 150,
        valueGetter: (p: any) => p.data?.partyName || p.data?.partyId || ''
      },
      { field: 'memo', headerName: 'Memo', flex: 1 },
      { 
        field: 'debit', 
        headerName: 'Debit', 
        width: 120,
        valueFormatter: (p) => p.value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(p.value) : ''
      },
      { 
        field: 'credit', 
        headerName: 'Credit', 
        width: 120,
        valueFormatter: (p) => p.value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(p.value) : ''
      },
      {
        headerName: 'Cleared?',
        cellRenderer: ToggleCell,
        width: 100,
        suppressSizeToFit: true,
        sortable: false,
        filter: false,
      }
    ];
  }, [reconciliation?.status]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!reconciliation) return <div className="p-4">Reconciliation not found</div>;

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
                      title="Back"
                    >
                      ←
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                      Reconciliation: {reconciliation.accountName}
                    </h1>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isPosted 
                        ? 'bg-emerald-50 text-[var(--success)] border-emerald-200' 
                        : 'bg-amber-50 text-[var(--warning)] border-amber-200'
                    }`}>
                      {isPosted ? 'Posted' : 'Draft'}
                    </span>
                    <span className="text-sm text-gray-500 font-medium ml-2">
                      Statement Date: {reconciliation.statementDate}
                    </span>
                    <div className="flex items-center bg-[#f0f8f6] rounded px-2 py-0.5 ml-2">
                      <span className="text-[10px] font-bold text-[#006b5c] uppercase tracking-wider mr-1.5">ROWS</span>
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
                          Discard
                        </button>
                        <button
                          onClick={handlePost}
                          disabled={posting || Math.abs(reconciliation.variance) > 0.001}
                          className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          title={Math.abs(reconciliation.variance) > 0.001 ? "Variance must be zero to post" : ""}
                        >
                          {posting ? 'Posting...' : 'Post Reconciliation'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Opening Balance</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.openingBalance)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cleared Balance</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.clearedBalance)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Statement Balance</div>
                    <div className="text-xl font-bold mt-0.5 text-gray-900">
                      {formatCurrency(reconciliation.statementBalance)}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${Math.abs(reconciliation.variance) < 0.001 ? 'bg-[#f0f8f6] border-[#006b5c]/30' : 'bg-red-50 border-red-200'}`}>
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${Math.abs(reconciliation.variance) < 0.001 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
                      Variance
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
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Quick Adjustment
                      </button>
                      <button
                        onClick={() => setSplitModalOpen(true)}
                        disabled={!selectedRow || selectedRow.isCleared}
                        className="btn btn-secondary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!selectedRow ? "Select a row to split" : selectedRow.isCleared ? "Cannot split an already cleared row" : ""}
                      >
                        <span className="material-symbols-outlined text-[18px]">call_split</span>
                        Split Entry
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
