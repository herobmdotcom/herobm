'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import JournalEntrySlideOver, { JournalEntry } from './journal-entries/JournalEntrySlideOver';
import CodesModal from './CodesModal';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import type { ColDef, ValueFormatterParams, ICellRendererParams, ValueGetterParams } from 'ag-grid-community';

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
  const tCodes = useTranslations('gl.codes');
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
  const [isCodesOpen, setIsCodesOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    api.glControllerGetAccounts({ format: 'flat' })
      .then(res => {
        const data = res.data || [];
        const leafAccounts = data.filter((a: unknown) => !(a as { isGroup: boolean }).isGroup);
        setAccounts(leafAccounts.map((a: unknown) => ({ accountCode: (a as { accountCode: string }).accountCode, name: (a as { name: string }).name })));
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
    api.glControllerGetGeneralLedger({ 
      account: accountCode, 
      fromDate: fromDate, 
      toDate: toDate, 
      page: page.toString(), 
      limit: PAGE_SIZE.toString() 
    })
      .then((res) => {
        const payload = res.data;
        setRows((payload as unknown as { data: GlEntry[] }).data || []);
        setTotal((payload as unknown as { total: number }).total || 0);
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
      valueFormatter: (p: ValueFormatterParams<GlEntry>) => formatLocalDate(p.value as string, undefined, '')
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
      headerName: t('columns.glAccount'),
      width: 250,
      cellRenderer: (p: ICellRendererParams<GlEntry>) => {
        return (
          <span>
            <span className="font-mono text-gray-400 mr-2">{p.value}</span>
            {p.data?.accountName}
          </span>
        );
      }
    },
    { 
      field: 'lineMemo', 
      headerName: t('columns.memo'), 
      flex: 1, 
      minWidth: 200,
      valueGetter: (p: ValueGetterParams<GlEntry>) => p.data?.lineMemo || p.data?.entryMemo || ''
    },
    { 
      field: 'debit', 
      headerName: t('columns.debit'), 
      width: 120,
      cellClass: 'text-right font-mono',
      valueFormatter: (p: ValueFormatterParams<GlEntry>) => fmt(p.value as string | number)
    },
    { 
      field: 'credit', 
      headerName: t('columns.credit'), 
      width: 120,
      cellClass: 'text-right font-mono',
      valueFormatter: (p: ValueFormatterParams<GlEntry>) => fmt(p.value as string | number)
    }
  ], [t, tCommon]);

  // We manage data externally, so we feed it directly to DataGrid via fetchAll + a dummy endpoint
  // Actually, we'll bypass DataGrid's own fetching by providing the data externally.
  // Since DataGrid always fetches, we'll use its renderHeader but handle data ourselves.

  return (
    <>
    <DataGrid<GlEntry>
      endpoint={`/api/gl/general-ledger?account=${accountCode}&fromDate=${fromDate}&toDate=${toDate}`}
      columns={columns}
      gridKey="gl-general-ledger"
      exportFileName="general-ledger"
      fetchAll={true}
      defaultSortModel={[{ colId: 'entryDate', sort: 'desc' }]}
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
      pageTitle={t('title')}
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsCodesOpen(true)}
          className="whitespace-nowrap"
        >
          {tCodes('button')}
        </Button>
      }
      secondaryHeader={
        <div className="flex flex-wrap items-center justify-start gap-4">
          <select
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            className="input text-xs h-9 border-gray-200 !w-auto min-w-[240px] bg-white rounded-lg"
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
        </div>
      }
    />

      <JournalEntrySlideOver
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />

      <CodesModal 
        isOpen={isCodesOpen}
        onClose={() => setIsCodesOpen(false)}
      />
    </>
  );
}
