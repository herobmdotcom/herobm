'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface GlRow {
  entry_date: string;
  entry_number: string;
  account_code: string;
  account_name: string;
  memo: string | null;
  debit: string;
  credit: string;
}

interface AccountOption {
  accountCode: string;
  name: string;
}

function fmt(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n || n === 0) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GeneralLedgerPage() {
  const t = useTranslations('gl.generalLedger');
  const tGeneral = useTranslations('gl');
  const [rows, setRows] = useState<GlRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountCode, setAccountCode] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Load accounts for the filter dropdown
  useEffect(() => {
    apiFetch<any[]>('/api/gl/accounts?format=flat')
      .then((data) => {
        const leafAccounts = data.filter((a) => !a.isGroup);
        setAccounts(leafAccounts.map((a) => ({ accountCode: a.accountCode, name: a.name })));
      })
      .catch((err) => reportError(err, 'GeneralLedgerPage'));
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (accountCode) params.set('account', accountCode);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const qs = params.toString() ? `?${params}` : '';
    apiFetch<GlRow[]>(`/api/gl/general-ledger${qs}`)
      .then(setRows)
      .catch((err) => reportError(err, 'GeneralLedgerPage'))
      .finally(() => setLoading(false));
  }, [accountCode, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute running balance
  let runningBalance = 0;
  const rowsWithBalance = rows.map((r) => {
    runningBalance += parseFloat(r.debit || '0') - parseFloat(r.credit || '0');
    return { ...r, runningBalance };
  });

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
            <select
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                minWidth: 200,
              }}
            >
              <option value="">{t('allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.accountCode} value={a.accountCode}>
                  {a.accountCode} — {a.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('fromDate')}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('toDate')}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
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
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.date')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.entryNumber')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.account')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.memo')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.debit')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.credit')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="animate-pulse">{tGeneral('loading')}</div>
                  </td>
                </tr>
              ) : rowsWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                rowsWithBalance.map((r, i) => (
                  <tr
                    key={`${r.entry_number}-${i}`}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(r.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/general-ledger/journal-entries?entry=${encodeURIComponent(r.entry_number)}`}
                        className="hover:underline"
                        style={{ color: 'var(--accent)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.entry_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{r.account_code}</span>
                      {' '}{r.account_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{r.memo || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(r.debit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(r.credit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: r.runningBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {fmt(r.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
