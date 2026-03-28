'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import JournalEntrySlideOver, { JournalEntry } from './JournalEntrySlideOver';

function sourceLabel(type: string) {
  const labels: Record<string, string> = {
    sales_invoice: 'Sales Invoice',
    purchase_invoice: 'Purchase Invoice',
    manual: 'Manual',
  };
  return labels[type] || type;
}

export default function JournalEntriesPage() {
  const t = useTranslations('gl.journalEntries');
  const tCommon = useTranslations('common');
  const router = useRouter();
  
  const searchParams = useSearchParams();
  const entryParam = searchParams.get('entry') || '';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceType, setSourceType] = useState('');

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const prevEntryParam = useRef(entryParam);
  useEffect(() => {
    if (entryParam !== prevEntryParam.current) {
      prevEntryParam.current = entryParam;
      // We could use API search to get the exact entry and set it if desired,
      // but for now DataGrid's internal search parameter is seeded via URL
      // so the user can just click it. Or we let DataGrid "initialSearch" handle it.
    }
  }, [entryParam]);

  const columns = useMemo<ColDef[]>(() => [
    { 
      field: 'entryNumber', 
      headerName: t('columns.entryNumber'), 
      width: 130, 
      pinned: 'left',
      cellStyle: { fontWeight: 'bold', color: 'var(--accent)', cursor: 'pointer' }
    },
    { 
      field: 'entryDate', 
      headerName: t('columns.date'), 
      width: 150,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : ''
    },
    { 
      field: 'sourceType', 
      headerName: t('columns.source'), 
      width: 160,
      valueFormatter: (p: any) => p.value ? sourceLabel(p.value) : ''
    },
    { 
      field: 'memo', 
      headerName: t('columns.memo'), 
      flex: 1, 
      minWidth: 200 
    },
    { 
      field: 'createdBy', 
      headerName: 'Created By', 
      width: 140 
    }
  ], [t]);

  const endpoint = `/api/gl/journal-entries?fromDate=${fromDate}&toDate=${toDate}&sourceType=${sourceType}`;

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid<JournalEntry>
            endpoint={endpoint}
            columns={columns}
            gridKey="gl-journal-entries"
            searchPlaceholder={t('searchPlaceholder', { defaultValue: 'Search entry number…' })}
            exportFileName="journal-entries"
            initialSearch={entryParam}
            onRowClicked={(row) => setSelectedEntry(row)}
            renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
              <div className="flex items-center justify-between px-6 py-4 flex-wrap gap-4 border-b border-gray-100">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {t('title')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tCommon('grid.rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {loading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex-1 max-w-md shrink-0">
                    {searchInput}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="input text-sm h-10 border-gray-200 w-auto min-w-[140px]"
                  >
                    <option value="">{t('allSources')}</option>
                    <option value="sales_invoice">{t('sourceSalesInvoice')}</option>
                    <option value="purchase_invoice">{t('sourcePurchaseInvoice')}</option>
                    <option value="manual">{t('sourceManual')}</option>
                  </select>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input text-sm h-10 border-gray-200 text-gray-500 w-auto min-w-[140px]"
                    title={t('fromDate')}
                  />
                  <span className="text-gray-400 font-bold px-1">&middot;</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input text-sm h-10 border-gray-200 text-gray-500 w-auto min-w-[140px]"
                    title={t('toDate')}
                  />
                  
                  <div className="h-6 w-px bg-gray-200 mx-1 border-r border-gray-200"></div>
                  
                  {optionsButton}
                  
                  <button
                    onClick={() => router.push('/general-ledger/journal-entries/new')}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 ml-1 shadow-sm"
                  >
                    + {t('newEntry', { defaultValue: 'New Entry' })}
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <JournalEntrySlideOver
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  );
}
