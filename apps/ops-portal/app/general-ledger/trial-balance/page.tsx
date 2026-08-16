'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useCallback } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

function typeBadge(type?: string) {
  if (!type) return null;
  const badgeClasses: Record<string, string> = {
    asset: 'bg-blue-500/10 text-blue-500',
    liability: 'bg-amber-500/10 text-amber-500',
    equity: 'bg-purple-500/10 text-purple-500',
    income: 'bg-emerald-500/10 text-emerald-500',
    expense: 'bg-red-500/10 text-red-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${badgeClasses[type] || 'bg-gray-500/10 text-gray-500'}`}>
      {type}
    </span>
  );
}

export default function TrialBalancePage() {
  const router = useRouter();
  useDocumentTitle('Trial Balance');
  const t = useTranslations('gl.trialBalance');
  const tGeneral = useTranslations('gl');
  const tCommon = useTranslations('common');

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!n || n === 0) return tCommon('na');
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const [rows, setRows] = useState<api.TrialBalanceResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [reportMode, setReportMode] = useState<'point_in_time' | 'periodic'>('point_in_time');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = reportMode === 'periodic' 
      ? { asOfDate, periodStart } 
      : { asOfDate };

    api.glControllerGetTrialBalance(params)
      .then(res => setRows(res.data))
      .catch((err) => reportError(err, 'TrialBalancePage'))
      .finally(() => setLoading(false));
  }, [asOfDate, periodStart, reportMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPeriodDebit = rows.reduce((s, r) => s + (r.periodDebit || 0), 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + (r.periodCredit || 0), 0);
  // Optional: totals for opening/closing
  const totalOpening = rows.reduce((s, r) => s + (r.openingBalance || 0), 0);
  const totalClosing = rows.reduce((s, r) => s + (r.closingBalance || 0), 0);
  const totalYtd = rows.reduce((s, r) => s + (r.ytdBalance || 0), 0);
  const totalYtdDebit = rows.reduce((s, r) => s + (r.ytdDebit || 0), 0);
  const totalYtdCredit = rows.reduce((s, r) => s + (r.ytdCredit || 0), 0);

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('title')}
          actions={
            <div className="flex items-center gap-4">
              <select
                value={reportMode}
                onChange={(e) => setReportMode(e.target.value as 'point_in_time' | 'periodic')}
                className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
              >
                <option value="point_in_time">Point in Time</option>
                <option value="periodic">Periodic</option>
              </select>

              {reportMode === 'periodic' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    {t('fromDate')}
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => {
                      if (e.target.validity.valid && e.target.value) {
                        setPeriodStart(e.target.value);
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  {reportMode === 'periodic' ? t('toDate') : t('asOfDate')}
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => {
                    if (e.target.validity.valid && e.target.value) {
                      setAsOfDate(e.target.value);
                    }
                  }}
                  className="text-sm px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="card overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.accountCode')}</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.accountName')}</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.accountType')}</th>
                {reportMode === 'periodic' && (
                  <>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">Opening Bal</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">Period Dr</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">Period Cr</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">Closing Bal</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">YTD Dr</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">YTD Cr</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">YTD Bal</th>
                  </>
                )}
                {reportMode === 'point_in_time' && (
                  <>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.debit')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.credit')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">{t('columns.balance')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    <div className="animate-pulse">{tGeneral('loading')}</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((r) => (
                    <tr
                      key={r.accountCode}
                      className="transition-colors border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{r.accountCode}</td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.name}</td>
                      <td className="px-4 py-2.5">{typeBadge(r.accountType)}</td>
                      
                      {reportMode === 'periodic' && (
                        <>
                          <td className={`px-4 py-2.5 text-right font-mono ${r.openingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>{fmt(r.openingBalance)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.periodDebit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.periodCredit)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>{fmt(r.closingBalance)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.ytdDebit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.ytdCredit)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${r.ytdBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>{fmt(r.ytdBalance)}</td>
                        </>
                      )}
                      
                      {reportMode === 'point_in_time' && (
                        <>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.periodDebit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">{fmt(r.periodCredit)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>{fmt(r.closingBalance)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td colSpan={3} className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                      {t('totals')}
                    </td>
                    {reportMode === 'periodic' && (
                      <>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalOpening)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalPeriodDebit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalPeriodCredit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalClosing)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalYtdDebit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalYtdCredit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalYtd)}</td>
                      </>
                    )}
                    {reportMode === 'point_in_time' && (
                      <>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalPeriodDebit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalPeriodCredit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmt(totalClosing)}</td>
                      </>
                    )}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DetailsLayout>
  );
}
