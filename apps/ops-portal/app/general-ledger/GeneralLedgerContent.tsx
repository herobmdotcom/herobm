'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import JournalEntrySlideOver, { JournalEntry } from './journal-entries/JournalEntrySlideOver';
import LedgerIntegrityAuditSlideOver from './LedgerIntegrityAuditSlideOver';
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
  runningBalance?: number | null;
}

export default function GeneralLedgerContent() {
  const t = useTranslations('gl.generalLedger');
  const tCodes = useTranslations('gl.codes');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();

  function fmt(v: string | number | null | undefined) {
    if (v === null || v === undefined || v === '') return tCommon('na');
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n) || n === 0) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountCode, setAccountCode] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isCodesOpen, setIsCodesOpen] = useState(false);

  const auditEventIdFromUrl = searchParams.get('auditEventId');
  const [auditEventId, setAuditEventId] = useState<string | null>(auditEventIdFromUrl);
  const [isIntegrityOpen, setIsIntegrityOpen] = useState(Boolean(auditEventIdFromUrl));

  useEffect(() => {
    if (auditEventIdFromUrl) {
      setAuditEventId(auditEventIdFromUrl);
      setIsIntegrityOpen(true);
    }
  }, [auditEventIdFromUrl]);

  const handleCloseIntegrityAudit = () => {
    setIsIntegrityOpen(false);
    setAuditEventId(null);
    if (searchParams.has('auditEventId')) {
      router.replace('/general-ledger', { scroll: false });
    }
  };

  useEffect(() => {
    api.glControllerGetAccounts({ format: 'flat' })
      .then(res => {
        const data = res.data || [];
        const leafAccounts = data.filter((a: unknown) => !(a as { isGroup: boolean }).isGroup);
        setAccounts(leafAccounts.map((a: unknown) => ({
          accountCode: (a as { accountCode: string }).accountCode,
          name: (a as { name: string }).name,
        })));
      })
      .catch((err) => reportError(err, 'GeneralLedgerPage'));
  }, []);

  // Fetch account summary KPI banner when a single account is selected
  const { data: accountSummary } = useSWR(
    accountCode ? ['gl-account-summary', accountCode, fromDate, toDate] : null,
    async () => {
      const res = await api.glControllerGetGeneralLedger({
        account: accountCode,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page: '1',
        limit: '1',
      });
      const payload = res.data as { accountSummary?: api.GlAccountSummaryDto | null };
      return payload?.accountSummary || null;
    },
    {
      keepPreviousData: true,
      onError: (err) => reportError(err, 'GeneralLedgerSummary'),
    }
  );

  const columns = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
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
              <span className="font-mono text-[var(--text-muted)] mr-2">{p.value}</span>
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
    ];

    if (accountCode) {
      cols.push({
        field: 'runningBalance',
        headerName: t('columns.runningBalance'),
        width: 150,
        cellClass: (p: ValueFormatterParams<GlEntry>) => {
          const val = typeof p.value === 'string' ? parseFloat(p.value) : (p.value as number);
          return `text-right font-mono font-semibold ${val < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`;
        },
        valueFormatter: (p: ValueFormatterParams<GlEntry>) => fmt(p.value as string | number)
      });
    }

    return cols;
  }, [t, tCommon, accountCode]);

  return (
    <>
      <DataGrid<GlEntry>
        endpoint={`/api/gl/general-ledger?account=${accountCode}&fromDate=${fromDate}&toDate=${toDate}`}
        columns={columns}
        gridKey="gl-general-ledger"
        exportFileName={accountCode ? `general-ledger-${accountCode}` : 'general-ledger'}
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAuditEventId(null);
                setIsIntegrityOpen(true);
              }}
              className="whitespace-nowrap flex items-center gap-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-[16px] text-accent">verified_user</span>
              {t('auditStatus')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCodesOpen(true)}
              className="whitespace-nowrap"
            >
              {tCodes('button')}
            </Button>
          </div>
        }
        secondaryHeader={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-4 w-full">
              <select
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="input text-xs h-9 w-full sm:!w-auto sm:min-w-[260px] rounded-lg"
              >
                <option value="">{t('allAccounts')}</option>
                {accounts.map((a) => (
                  <option key={a.accountCode} value={a.accountCode}>
                    {a.accountCode} — {a.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input text-xs h-9 px-2 sm:px-3 rounded-lg flex-1 sm:flex-initial sm:w-auto min-w-0"
                  title={t('fromDate')}
                />
                <span className="text-[var(--text-muted)] font-bold shrink-0">→</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input text-xs h-9 px-2 sm:px-3 rounded-lg flex-1 sm:flex-initial sm:w-auto min-w-0"
                  title={t('toDate')}
                />
              </div>
            </div>

            {accountCode && accountSummary && (
              <div className="flex flex-wrap items-center gap-6 py-2.5 px-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] w-full">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {t('openingBalance')}
                  </span>
                  <span className={`text-sm font-mono font-bold ${(accountSummary.openingBalance ?? 0) < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
                    ${fmt(accountSummary.openingBalance)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {t('periodDebits')}
                  </span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                    ${fmt(accountSummary.periodDebit)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {t('periodCredits')}
                  </span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                    ${fmt(accountSummary.periodCredit)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {t('netMovement')}
                  </span>
                  <span className={`text-sm font-mono font-bold ${(accountSummary.netMovement ?? 0) < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
                    ${fmt(accountSummary.netMovement)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {t('closingBalance')}
                  </span>
                  <span className={`text-sm font-mono font-bold ${(accountSummary.closingBalance ?? 0) < 0 ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>
                    ${fmt(accountSummary.closingBalance)}
                  </span>
                </div>
              </div>
            )}
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

      <LedgerIntegrityAuditSlideOver
        isOpen={isIntegrityOpen}
        onClose={handleCloseIntegrityAudit}
        eventId={auditEventId}
      />
    </>
  );
}

