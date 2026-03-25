'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface JournalEntry {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  createdBy: string | null;
  lines?: JournalLine[];
}

interface JournalLine {
  journalLineId: string;
  accountCode?: string;
  accountName?: string;
  partyType?: string | null;
  partyId?: string | null;
  debit: string;
  credit: string;
  memo: string | null;
}

interface PaginatedResponse {
  data: JournalEntry[];
  page: number;
  limit: number;
  total: number;
}

function fmt(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n || n === 0) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const tGeneral = useTranslations('gl');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceType, setSourceType] = useState('');
  const searchParams = useSearchParams();
  const entryParam = searchParams.get('entry') || '';
  const [searchTerm, setSearchTerm] = useState(entryParam);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLines, setExpandedLines] = useState<JournalLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const router = useRouter();
  const autoExpandedRef = useRef(false);
  const limit = 50;

  // React to ?entry= changes during SPA navigation
  const prevEntryParam = useRef(entryParam);
  useEffect(() => {
    if (entryParam !== prevEntryParam.current) {
      prevEntryParam.current = entryParam;
      autoExpandedRef.current = false;
      setSearchTerm(entryParam);
      setPage(1);
    }
  }, [entryParam]);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (sourceType) params.set('sourceType', sourceType);
    if (searchTerm) params.set('q', searchTerm);
    params.set('page', String(page));
    params.set('limit', String(limit));
    const qs = params.toString() ? `?${params}` : '';
    apiFetch<PaginatedResponse>(`/api/gl/journal-entries${qs}`)
      .then((res) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch((err) => reportError(err, 'JournalEntriesPage'))
      .finally(() => setLoading(false));
  }, [fromDate, toDate, sourceType, searchTerm, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };
  const handleFromDate = (value: string) => { setFromDate(value); setPage(1); };
  const handleToDate = (value: string) => { setToDate(value); setPage(1); };
  const handleSourceType = (value: string) => { setSourceType(value); setPage(1); };

  const toggleExpand = (entry: JournalEntry) => {
    if (expandedId === entry.journalEntryId) {
      setExpandedId(null);
      setExpandedLines([]);
      return;
    }
    setExpandedId(entry.journalEntryId);
    setLoadingLines(true);
    apiFetch<any>(`/api/gl/journal-entries/${entry.journalEntryId}`)
      .then((detail) => setExpandedLines(detail.lines || []))
      .catch((err) => reportError(err, 'JournalEntriesPage'))
      .finally(() => setLoadingLines(false));
  };

  // Auto-expand the entry linked from ?entry= query param
  useEffect(() => {
    if (!entryParam || autoExpandedRef.current || loading || entries.length === 0) return;
    const match = entries.find((e) => e.entryNumber === entryParam);
    if (match) {
      autoExpandedRef.current = true;
      toggleExpand(match);
    }
  }, [entryParam, loading, entries]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <>
      <div className="h-full flex flex-col p-4 lg:p-6">
        {/* Header + Filters */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2
            className="text-[1.3rem] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}
          >
            {t('title')}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px]"
                style={{ color: 'var(--text-muted)' }}
              >
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('searchPlaceholder', { defaultValue: 'Search entry number…' })}
                className="text-sm pl-8 pr-3 py-1.5 rounded-lg border"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  minWidth: 200,
                }}
              />
            </div>
            <select
              value={sourceType}
              onChange={(e) => handleSourceType(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('allSources')}</option>
              <option value="sales_invoice">{t('sourceSalesInvoice')}</option>
              <option value="purchase_invoice">{t('sourcePurchaseInvoice')}</option>
              <option value="manual">{t('sourceManual')}</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('fromDate')}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDate(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('toDate')}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleToDate(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button
              onClick={() => router.push('/general-ledger/journal-entries/new')}
              className="px-3 py-1.5 text-xs font-bold rounded shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Manrope, sans-serif' }}
            >
              + {t('newEntry', { defaultValue: 'New Entry' })}
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          className="flex-1 min-h-0 overflow-auto rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.entryNumber')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.date')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.memo')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.source')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.totalDebit')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.totalCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="animate-pulse">{tGeneral('loading')}</div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedId === entry.journalEntryId;
                  // Compute totals from entry-level lines if available, otherwise show —
                  const debitTotal = entry.lines
                    ? entry.lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0)
                    : null;
                  const creditTotal = entry.lines
                    ? entry.lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0)
                    : null;

                  return (
                    <React.Fragment key={entry.journalEntryId}>
                      <tr
                        className="transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onClick={() => toggleExpand(entry)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="w-8 px-2 py-2.5 text-center">
                          <span
                            className="material-symbols-outlined text-[16px] transition-transform"
                            style={{
                              color: 'var(--text-muted)',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                          >
                            {'chevron_right'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--accent)' }}>{entry.entryNumber}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(entry.entryDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>{entry.memo || '—'}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {entry.sourceType === 'sales_invoice' && entry.sourceId ? (
                            <Link
                              href={`/sales-orders/invoices?invoice=${encodeURIComponent(entry.sourceId)}`}
                              className="hover:underline"
                              style={{ color: 'var(--accent)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {sourceLabel(entry.sourceType)}
                            </Link>
                          ) : (
                            sourceLabel(entry.sourceType)
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                          {debitTotal !== null ? fmt(debitTotal) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                          {creditTotal !== null ? fmt(creditTotal) : '—'}
                        </td>
                      </tr>

                      {/* Expanded detail lines */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                            <div className="px-8 py-3">
                              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                {t('lines')}
                              </p>
                              {loadingLines ? (
                                <div className="animate-pulse text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                                  {tGeneral('loading')}
                                </div>
                              ) : (
                                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="text-left px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.account')}</th>
                                      <th className="text-left px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Party</th>
                                      <th className="text-right px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.debit')}</th>
                                      <th className="text-right px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.credit')}</th>
                                      <th className="text-left px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.memo')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedLines.map((line) => (
                                      <tr key={line.journalLineId} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>
                                          <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                                            {line.accountCode}
                                          </span>{' '}
                                          {line.accountName}
                                        </td>
                                        <td className="px-3 py-1.5 capitalize text-xs" style={{ color: 'var(--text-secondary)' }}>
                                          {line.partyType ? (
                                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border font-mono">
                                              {line.partyType}: {line.partyId?.substring(0, 8)}...
                                            </span>
                                          ) : '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(line.debit)}</td>
                                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(line.credit)}</td>
                                        <td className="px-3 py-1.5" style={{ color: 'var(--text-muted)' }}>{line.memo || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {total.toLocaleString()} {t('totalEntries', { defaultValue: 'entries' })}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-xs font-medium rounded border transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {page} / {totalPages}
              </span>
              <button
                className="px-3 py-1 text-xs font-medium rounded border transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
