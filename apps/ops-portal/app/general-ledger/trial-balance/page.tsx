'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useCallback } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

interface TrialBalanceRow {
  account_code: string;
  name: string;
  account_type: string;
  total_debit: string;
  total_credit: string;
  balance: string;
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    asset: '#3b82f6',
    liability: '#f59e0b',
    equity: '#8b5cf6',
    income: '#10b981',
    expense: '#ef4444',
  };
  return (
    <span
      style={{
        background: `${colors[type] || '#6b7280'}18`,
        color: colors[type] || '#6b7280',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
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
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(() => {
    setLoading(true);
    api.glControllerGetTrialBalance({ asOfDate })
      .then(res => setRows(res.data as unknown as TrialBalanceRow[]))
      .catch((err) => reportError(err, 'TrialBalancePage'))
      .finally(() => setLoading(false));
  }, [asOfDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDebit = rows.reduce((s, r) => s + parseFloat(r.total_debit || '0'), 0);
  const totalCredit = rows.reduce((s, r) => s + parseFloat(r.total_credit || '0'), 0);

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('title')}
          onBack={() => router.back()}
          actions={
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('asOfDate')}
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => {
                  if (e.target.validity.valid && e.target.value) {
                    setAsOfDate(e.target.value);
                  }
                }}
                className="text-sm px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all invalid:border-red-500 invalid:text-red-600"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="card overflow-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.accountCode')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.accountName')}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.accountType')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.debit')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.credit')}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('columns.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="animate-pulse">{tGeneral('loading')}</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((r) => (
                    <tr
                      key={r.account_code}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.account_code}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                      <td className="px-4 py-2.5">{typeBadge(r.account_type)}</td>
                      <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(r.total_debit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(r.total_credit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: parseFloat(r.balance) < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <td colSpan={3} className="px-4 py-3 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      {t('totals')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(totalCredit)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(totalDebit - totalCredit)}</td>
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
