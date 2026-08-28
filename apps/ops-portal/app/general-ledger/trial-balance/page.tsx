'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useCallback } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { DATA_SOURCE_CONTEXT, getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

function typeBadge(type?: string) {
  if (!type) return null;
  const badgeClasses: Record<string, string> = {
    asset: 'bg-blue-500/10 text-blue-500',
    liability: 'bg-amber-500/10 text-amber-500',
    equity: 'bg-purple-500/10 text-purple-500',
    revenue: 'bg-emerald-500/10 text-emerald-500',
    income: 'bg-emerald-500/10 text-emerald-500',
    expense: 'bg-red-500/10 text-red-500',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${badgeClasses[type] || 'bg-gray-500/10 text-gray-500'}`}
    >
      {type}
    </span>
  );
}

function getPeriodLockBadge(status?: string) {
  if (status === 'hard_closed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
        <span className="material-symbols-outlined text-xs">lock</span>
        <span>Closed Period (Immutable)</span>
      </span>
    );
  }
  if (status === 'soft_locked') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
        <span className="material-symbols-outlined text-xs">lock_clock</span>
        <span>Soft Locked</span>
      </span>
    );
  }
  return null;
}

function formatReconTitle(isBalanced: boolean): string {
  return isBalanced
    ? 'Continuous Subledger Reconciliation: All Accounts in Balance'
    : 'Continuous Subledger Reconciliation: Discrepancy Detected';
}

function getReconIconName(isBalanced: boolean): string {
  return isBalanced ? 'verified' : 'warning';
}

function getBannerClasses(isBalanced: boolean): string {
  return isBalanced
    ? 'p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-50/50 border-emerald-200'
    : 'p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/50 border-amber-200';
}

function getIconBoxClasses(isBalanced: boolean): string {
  return isBalanced
    ? 'w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-700'
    : 'w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 text-amber-700';
}

function getPillClasses(isMatched: boolean): string {
  return isMatched
    ? 'px-2.5 py-1 rounded-md font-medium border bg-emerald-100/60 text-emerald-800 border-emerald-300'
    : 'px-2.5 py-1 rounded-md font-medium border bg-amber-100 text-amber-800 border-amber-300';
}

function formatStatusPill(
  label: string,
  isMatched: boolean,
  drift: number,
): string {
  if (isMatched) {
    return `${label}: Matched`;
  }
  return `${label}: Drift $${drift.toFixed(2)}`;
}

export default function TrialBalancePage() {
  useDocumentTitle('Trial Balance');
  const t = useTranslations('gl.trialBalance');
  const tGeneral = useTranslations('gl');
  const tCommon = useTranslations('common');

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!n || n === 0) return tCommon('na');
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const [rows, setRows] = useState<api.TrialBalanceResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconReport, setReconReport] =
    useState<api.SubledgerReconciliationResponseDto | null>(null);
  const [periods, setPeriods] = useState<api.FiscalPeriodResponseDto[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCashFlowPdf, setExportingCashFlowPdf] = useState(false);

  const handleExportPeriodClosePdf = async () => {
    const targetPeriodId = selectedPeriodId || periods[0]?.periodId;
    if (!targetPeriodId) {
      toast.error('No fiscal period available for audit export');
      return;
    }
    try {
      setExportingPdf(true);
      const res = await api.pdfTemplatesControllerRunHook(
        'period-close-audit',
        {},
        {
          id: targetPeriodId,
          context: DATA_SOURCE_CONTEXT.PERIOD_CLOSE_AUDIT,
        },
      );
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: unknown) {
      reportError(err, 'TrialBalancePage:exportAuditPdf');
      toast.error('Failed to generate Period Close Audit PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCashFlowPdf = async () => {
    const targetPeriodId = selectedPeriodId || periods[0]?.periodId;
    if (!targetPeriodId) {
      toast.error('No fiscal period available for cash flow export');
      return;
    }
    try {
      setExportingCashFlowPdf(true);
      const res = await api.pdfTemplatesControllerRunHook(
        'cash-flow-statement',
        {},
        {
          id: targetPeriodId,
          context: DATA_SOURCE_CONTEXT.CASH_FLOW_STATEMENT,
        },
      );
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: unknown) {
      reportError(err, 'TrialBalancePage:exportCashFlowPdf');
      toast.error('Failed to generate Cash Flow Statement PDF');
    } finally {
      setExportingCashFlowPdf(false);
    }
  };

  const [reportMode, setReportMode] = useState<
    'point_in_time' | 'periodic' | 'fiscal_period'
  >('point_in_time');
  const [asOfDate, setAsOfDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });

  // Load fiscal periods and continuous subledger reconciliation
  useEffect(() => {
    api
      .glControllerGetFiscalPeriods({})
      .then((res) => {
        setPeriods(res.data || []);
      })
      .catch((err) => {
        reportError(err, 'TrialBalancePage.getFiscalPeriods');
        toast.error('Failed to load fiscal periods: ' + getErrorMessage(err));
      });

    api
      .glControllerGetSubledgerReconciliation()
      .then((res) => {
        setReconReport(res.data);
      })
      .catch((err) => {
        reportError(err, 'TrialBalancePage.getSubledgerReconciliation');
      });
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params =
      reportMode === 'periodic' || reportMode === 'fiscal_period'
        ? { asOfDate, periodStart }
        : { asOfDate };

    api
      .glControllerGetTrialBalance(params)
      .then((res) => setRows(res.data))
      .catch((err) => reportError(err, 'TrialBalancePage'))
      .finally(() => setLoading(false));
  }, [asOfDate, periodStart, reportMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const p = periods.find((item) => item.periodId === periodId);
    if (p) {
      setPeriodStart(p.startDate);
      setAsOfDate(p.endDate);
    }
  };

  const selectedPeriod = periods.find((p) => p.periodId === selectedPeriodId);

  const totalPeriodDebit = rows.reduce((s, r) => s + (r.periodDebit || 0), 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + (r.periodCredit || 0), 0);
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
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={reportMode}
                onChange={(e) => {
                  const mode = e.target.value as
                    | 'point_in_time'
                    | 'periodic'
                    | 'fiscal_period';
                  setReportMode(mode);
                  if (mode === 'fiscal_period' && periods.length > 0) {
                    handlePeriodChange(periods[0].periodId);
                  }
                }}
                className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
              >
                <option value="point_in_time">Point in Time</option>
                <option value="periodic">Periodic</option>
                <option value="fiscal_period">Fiscal Period</option>
              </select>

              {reportMode === 'fiscal_period' && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] font-medium"
                  >
                    {periods.map((p) => (
                      <option key={p.periodId} value={p.periodId}>
                        {p.periodName} ({p.status.replace('_', ' ')})
                      </option>
                    ))}
                  </select>

                  {getPeriodLockBadge(selectedPeriod?.status)}
                </div>
              )}

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

              {reportMode !== 'fiscal_period' && (
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
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportCashFlowPdf}
                disabled={exportingCashFlowPdf}
                className="!py-1.5 !text-xs whitespace-nowrap"
              >
                {exportingCashFlowPdf ? t('exporting') : t('exportCashFlowPdf')}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPeriodClosePdf}
                disabled={exportingPdf}
                className="!py-1.5 !text-xs whitespace-nowrap"
              >
                {exportingPdf ? t('exporting') : t('exportAuditPdf')}
              </Button>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Subledger Integrity & Continuous Reconciliation Banner ── */}
        {reconReport && (
          <div className={getBannerClasses(reconReport.isOverallBalanced)}>
            <div className="flex items-center gap-3">
              <div className={getIconBoxClasses(reconReport.isOverallBalanced)}>
                <span className="material-symbols-outlined">
                  {getReconIconName(reconReport.isOverallBalanced)}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {formatReconTitle(reconReport.isOverallBalanced)}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Trial Balance Zero-Sum Net: $
                  {reconReport.trialBalanceZeroSum.netDifference.toFixed(2)} (Dr:
                  ${reconReport.trialBalanceZeroSum.totalDebit.toLocaleString()}{' '}
                  / Cr: $
                  {reconReport.trialBalanceZeroSum.totalCredit.toLocaleString()})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div
                className={getPillClasses(
                  reconReport.accountsReceivable.isMatched,
                )}
              >
                {formatStatusPill(
                  reconReport.accountsReceivable.controlAccountCode
                    ? `AR (${reconReport.accountsReceivable.controlAccountCode})`
                    : 'AR',
                  reconReport.accountsReceivable.isMatched,
                  reconReport.accountsReceivable.drift,
                )}
              </div>

              <div
                className={getPillClasses(reconReport.accountsPayable.isMatched)}
              >
                {formatStatusPill(
                  reconReport.accountsPayable.controlAccountCode
                    ? `AP (${reconReport.accountsPayable.controlAccountCode})`
                    : 'AP',
                  reconReport.accountsPayable.isMatched,
                  reconReport.accountsPayable.drift,
                )}
              </div>

              <div
                className={getPillClasses(
                  reconReport.goodsReceivedNotInvoiced.isMatched,
                )}
              >
                {formatStatusPill(
                  reconReport.goodsReceivedNotInvoiced.controlAccountCode
                    ? `GRNI (${reconReport.goodsReceivedNotInvoiced.controlAccountCode})`
                    : 'GRNI',
                  reconReport.goodsReceivedNotInvoiced.isMatched,
                  reconReport.goodsReceivedNotInvoiced.drift,
                )}
              </div>

              <div
                className={getPillClasses(
                  reconReport.perpetualInventory.isMatched,
                )}
              >
                {formatStatusPill(
                  reconReport.perpetualInventory.controlAccountCode
                    ? `Inventory (${reconReport.perpetualInventory.controlAccountCode})`
                    : 'Inventory',
                  reconReport.perpetualInventory.isMatched,
                  reconReport.perpetualInventory.drift,
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                  {t('columns.accountCode')}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                  {t('columns.accountName')}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                  {t('columns.accountType')}
                </th>
                {(reportMode === 'periodic' ||
                  reportMode === 'fiscal_period') && (
                  <>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      Opening Bal
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      Period Dr
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      Period Cr
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      Closing Bal
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      YTD Dr
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      YTD Cr
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      YTD Bal
                    </th>
                  </>
                )}
                {reportMode === 'point_in_time' && (
                  <>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      {t('columns.debit')}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      {t('columns.credit')}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px]">
                      {t('columns.balance')}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-[var(--text-muted)]"
                  >
                    <div className="animate-pulse">{tGeneral('loading')}</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-[var(--text-muted)]"
                  >
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
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                        {r.accountCode}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                        {r.name}
                      </td>
                      <td className="px-4 py-2.5">{typeBadge(r.accountType)}</td>

                      {(reportMode === 'periodic' ||
                        reportMode === 'fiscal_period') && (
                        <>
                          <td
                            className={`px-4 py-2.5 text-right font-mono ${r.openingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}
                          >
                            {fmt(r.openingBalance)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.periodDebit)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.periodCredit)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}
                          >
                            {fmt(r.closingBalance)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.ytdDebit)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.ytdCredit)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono font-semibold ${r.ytdBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}
                          >
                            {fmt(r.ytdBalance)}
                          </td>
                        </>
                      )}

                      {reportMode === 'point_in_time' && (
                        <>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.periodDebit)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {fmt(r.periodCredit)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}
                          >
                            {fmt(r.closingBalance)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td
                      colSpan={3}
                      className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      {t('totals')}
                    </td>
                    {(reportMode === 'periodic' ||
                      reportMode === 'fiscal_period') && (
                      <>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalOpening)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalPeriodDebit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalPeriodCredit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalClosing)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalYtdDebit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalYtdCredit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalYtd)}
                        </td>
                      </>
                    )}
                    {reportMode === 'point_in_time' && (
                      <>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalPeriodDebit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalPeriodCredit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                          {fmt(totalClosing)}
                        </td>
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
