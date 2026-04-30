'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import JournalEntrySlideOver, { JournalEntry } from './journal-entries/JournalEntrySlideOver';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

interface AccountOption {
  accountCode: string;
  name: string;
}

interface GlEntry {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  entryMemo: string | null;
  sourceType: string;
  sourceId: string | null;
  accountCode: string;
  accountName: string;
  partyType: string | null;
  partyId: string | null;
  debit: string;
  credit: string;
  lineMemo: string | null;
  createdBy: string | null;
  createdOn: string | null;
}

const PAGE_SIZE = 200;

export default function GeneralLedgerContent() {
  const t = useTranslations('gl.generalLedger');
  const tCommon = useTranslations('common');
  const tGrid = useTranslations('common.grid');

  function fmt(v: string | number | null | undefined) {
    if (!v) return tCommon('na');
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!n || n === 0) return tCommon('na');
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountCode, setAccountCode] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Manual pagination state (so we control it from the header, not the DataGrid overlay)
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<GlEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Load accounts for the filter dropdown
  useEffect(() => {
    apiFetch<any[]>('/api/gl/accounts?format=flat')
      .then((data) => {
        const leafAccounts = data.filter((a: any) => !a.isGroup);
        setAccounts(leafAccounts.map((a: any) => ({ accountCode: a.accountCode, name: a.name })));
      })
      .catch((err) => reportError(err, 'GeneralLedgerPage'));
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [accountCode, fromDate, toDate]);

  // Fetch GL data
  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (accountCode) params.set('account', accountCode);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    const qs = params.toString() ? `?${params}` : '';
    apiFetch<{ data: GlEntry[]; total: number }>(`/api/gl/general-ledger${qs}`)
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
      .catch((err) => reportError(err, 'GeneralLedgerContent'))
      .finally(() => setLoading(false));
  }, [accountCode, fromDate, toDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo<ColDef[]>(() => [
    { 
      field: 'entryDate', 
      headerName: t('columns.date'), 
      width: 120,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : ''
    },
    { 
      field: 'entryNumber', 
      headerName: t('columns.entryNumber'), 
      width: 140, 
      pinned: 'left',
      cellStyle: { fontWeight: 'bold', color: 'var(--accent)', cursor: 'pointer' }
    },
    {
      field: 'accountCode',
      headerName: t('columns.account'),
      width: 250,
      cellRenderer: (p: any) => {
        return (
          <span>
            <span className="font-mono text-gray-400 mr-2">{p.value}</span>
            {p.data.accountName}
          </span>
        );
      }
    },
    { 
      field: 'lineMemo', 
      headerName: t('columns.memo'), 
      flex: 1, 
      minWidth: 200,
      valueGetter: (p: any) => p.data.lineMemo || p.data.entryMemo || ''
    },
    { 
      field: 'debit', 
      headerName: t('columns.debit'), 
      width: 120,
      cellClass: 'text-right font-mono',
      valueFormatter: (p: any) => fmt(p.value)
    },
    { 
      field: 'credit', 
      headerName: t('columns.credit'), 
      width: 120,
      cellClass: 'text-right font-mono',
      valueFormatter: (p: any) => fmt(p.value)
    }
  ], [t, tCommon]);

  // We manage data externally, so we feed it directly to DataGrid via fetchAll + a dummy endpoint
  // Actually, we'll bypass DataGrid's own fetching by providing the data externally.
  // Since DataGrid always fetches, we'll use its renderHeader but handle data ourselves.

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid<GlEntry>
            endpoint={`/api/gl/general-ledger?account=${accountCode}&fromDate=${fromDate}&toDate=${toDate}`}
            columns={columns}
            gridKey="gl-general-ledger"
            exportFileName="general-ledger"
            fetchAll={true}
            onRowClicked={(row) => {
              setSelectedEntry({
                journalEntryId: row.journalEntryId,
                entryNumber: row.entryNumber,
                entryDate: row.entryDate,
                memo: row.entryMemo,
                sourceType: row.sourceType || 'manual',
                sourceId: row.sourceId || null,
                createdBy: row.createdBy || null,
              });
            }}
            renderHeader={({ optionsButton, rowCount, loading: gridLoading }) => (
              <div className="flex items-center px-6 py-4 gap-6 border-b border-gray-100">
                {/* Title + Row Count */}
                <div className="flex items-center gap-4 shrink-0">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {t('title')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tCommon('grid.rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {gridLoading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Filters */}
                <select
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  className="input text-xs h-9 border-gray-200 w-auto min-w-[200px] bg-white rounded-lg"
                >
                  <option value="">{t('allAccounts')}</option>
                  {accounts.map((a) => (
                    <option key={a.accountCode} value={a.accountCode}>
                      {a.accountCode} — {a.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input text-xs h-9 border-gray-200 bg-white px-3 text-gray-500 rounded-lg w-auto"
                    title={t('fromDate')}
                  />
                  <span className="text-gray-300 font-bold">→</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input text-xs h-9 border-gray-200 bg-white px-3 text-gray-500 rounded-lg w-auto"
                    title={t('toDate')}
                  />
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Options */}
                <div className="flex items-center gap-3 shrink-0">
                  {optionsButton}
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
