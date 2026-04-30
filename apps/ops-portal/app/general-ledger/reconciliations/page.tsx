/* eslint-disable i18next/no-literal-string */
'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

export default function ReconciliationsPage() {
  useDocumentTitle('Bank Reconciliations');
  const router = useRouter();

  const columns = useMemo<ColDef[]>(() => [
    { field: 'statementDate', headerName: 'Statement Date', width: 140 },
    { field: 'accountName', headerName: 'Account', flex: 1 },
    { 
      field: 'statementBalance', 
      headerName: 'Statement Balance', 
      width: 180,
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(params.value);
      }
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        const isPosted = params.value === 'posted';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
            isPosted 
              ? 'bg-emerald-50 text-[var(--success)] border-emerald-200' 
              : 'bg-amber-50 text-[var(--warning)] border-amber-200'
          }`}>
            {isPosted ? 'Posted' : 'Draft'}
          </span>
        );
      }
    }
  ], []);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 min-h-0 flex flex-col">
        <DataGrid
          endpoint="/api/gl/reconciliations"
          columns={columns}
          fetchAll={true}
          onRowClicked={(row: any) => router.push(`/general-ledger/reconciliations/${row.reconciliationId}`)}
          renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
            <div className="flex flex-col bg-white border-b border-gray-200">
              <div className="flex items-center px-6 py-4 gap-6">
                <div className="flex items-center gap-3 shrink-0">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">Bank Reconciliations</h1>
                  <div className="flex items-center bg-[#f0f8f6] rounded px-2 py-0.5 mt-0.5">
                    <span className="text-[10px] font-bold text-[#006b5c] uppercase tracking-wider mr-1.5">ROWS</span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {loading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1">
                  {searchInput}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {optionsButton}
                  <button
                    onClick={() => router.push('/general-ledger/reconciliations/new')}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 shadow-sm whitespace-nowrap"
                  >
                    + New Reconciliation
                  </button>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
