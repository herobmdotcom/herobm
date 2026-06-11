'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function ReconciliationsPage() {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));
  const router = useRouter();

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const isPosted = params.value === 'posted';
        return isPosted ? tCommon('states.posted') : tCommon('states.draft');
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onRowClicked={(row: any) => router.push(`/reconciliations/${row.reconciliationId}`)}
          pageTitle={t('title')}
          headerActions={
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/reconciliations/new')}
                className="px-3 lg:px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap"
              >
                + {t('newReconciliation')}
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
