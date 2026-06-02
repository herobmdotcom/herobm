'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import BankImportModal from './components/BankImportModal';

export default function ReconciliationsPage() {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));
  const router = useRouter();
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  const columns = useMemo<ColDef[]>(() => [
    { field: 'statementDate', headerName: t('columns.statementDate'), width: 140 },
    { field: 'accountName', headerName: t('columns.glAccount'), flex: 1 },
    { 
      field: 'statementBalance', 
      headerName: t('columns.statementBalance'), 
      width: 180,
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(params.value);
      }
    },
    { 
      field: 'status', 
      headerName: t('columns.status'), 
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
            {isPosted ? tCommon('states.posted') : tCommon('states.draft')}
          </span>
        );
      }
    }
  ], [t, tCommon]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 min-h-0 flex flex-col">
        <DataGrid
          endpoint="/api/gl/reconciliations"
          columns={columns}
          fetchAll={true}
          onRowClicked={(row: any) => router.push(`/general-ledger/reconciliations/${row.reconciliationId}`)}
          pageTitle={t('title')}
          headerActions={
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn btn-secondary"
              >
                {t('importStatement')}
              </button>
              <button
                onClick={() => router.push('/general-ledger/reconciliations/new')}
                className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap"
              >
                + {t('newReconciliation')}
              </button>
            </>
          }
        />
      </div>
      <BankImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={() => setIsImportModalOpen(false)} 
      />
    </div>
  );
}
