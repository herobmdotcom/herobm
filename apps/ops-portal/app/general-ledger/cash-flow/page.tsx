'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

function fmt(amount: number): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNeg ? `(${formatted})` : formatted;
}

export default function CashFlowPage() {
  const t = useTranslations('gl.cashFlow');
  useDocumentTitle(t('title'));

  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [data, setData] = useState<api.CashFlowStatementResponseDto | null>(null);
  const [periods, setPeriods] = useState<api.FiscalPeriodResponseDto[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [reportMode, setReportMode] = useState<'fiscal_period' | 'custom_range'>('fiscal_period');

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  // Load fiscal periods
  useEffect(() => {
    api
      .glControllerGetFiscalPeriods({})
      .then((res) => {
        const periodList = res.data || [];
        setPeriods(periodList);
        if (periodList.length > 0) {
          setSelectedPeriodId(periodList[0].periodId);
          setStartDate(periodList[0].startDate);
          setEndDate(periodList[0].endDate);
        }
      })
      .catch((err: unknown) => reportError(err, 'CashFlowPage:getFiscalPeriods'));
  }, []);

  const fetchData = useCallback(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    const selectedPeriod = periods.find((p) => p.periodId === selectedPeriodId);

    api
      .glControllerGetCashFlow({
        startDate,
        endDate,
        periodName: selectedPeriod?.periodName,
        fiscalYear: selectedPeriod?.fiscalYear,
        periodNumber: selectedPeriod?.periodNumber,
      })
      .then((res: { data: api.CashFlowStatementResponseDto }) => setData(res.data))
      .catch((err: unknown) => reportError(err, 'CashFlowPage:getCashFlow'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedPeriodId, periods]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const p = periods.find((item) => item.periodId === periodId);
    if (p) {
      setStartDate(p.startDate);
      setEndDate(p.endDate);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const res = await api.pdfTemplatesControllerRunHook(
        'cash-flow-statement',
        {},
        {
          id: selectedPeriodId || 'default',
          context: DATA_SOURCE_CONTEXT.CASH_FLOW_STATEMENT,
        },
      );
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: unknown) {
      reportError(err, 'CashFlowPage:exportPdf');
      toast.error('Failed to generate Cash Flow Statement PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const reconIcon = data?.reconciliation.isReconciled ? 'verified' : 'warning';

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
                  const mode = e.target.value as 'fiscal_period' | 'custom_range';
                  setReportMode(mode);
                  if (mode === 'fiscal_period' && periods.length > 0) {
                    handlePeriodChange(periods[0].periodId);
                  }
                }}
                className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
              >
                <option value="fiscal_period">{t('fiscalPeriod')}</option>
                <option value="custom_range">{t('customRange')}</option>
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
                </div>
              )}

              {reportMode === 'custom_range' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">{t('to')}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="!py-1.5 !text-xs whitespace-nowrap flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                {exportingPdf ? t('exporting') : t('exportPdf')}
              </Button>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Reconciliation Status Banner ── */}
        {data && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              data.reconciliation.isReconciled
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">
                {reconIcon}
              </span>
              <div>
                <h3 className="text-sm font-semibold">
                  {data.reconciliation.isReconciled ? t('reconciled') : t('unreconciled')}
                </h3>
                <p className="text-xs opacity-90">
                  {data.reconciliation.isReconciled ? t('reconciledDesc') : t('unreconciledDesc')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium opacity-75">{t('endingCash')}</div>
              <div className="text-lg font-bold font-mono">
                ${fmt(data.reconciliation.endingCash)}
              </div>
            </div>
          </div>
        )}

        {/* ── Summary Metric Cards ── */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">{t('beginningCash')}</div>
              <div className="text-xl font-bold font-mono mt-1 text-[var(--text-primary)]">
                ${fmt(data.reconciliation.beginningCash)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">{t('operatingCash')}</div>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  data.operatingActivities.netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                ${fmt(data.operatingActivities.netCash)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">{t('investingFinancing')}</div>
              <div className="text-xl font-bold font-mono mt-1 text-[var(--text-primary)]">
                ${fmt(data.investingActivities.netCash + data.financingActivities.netCash)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">{t('netPeriodChange')}</div>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  data.reconciliation.netChangeInCash >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                ${fmt(data.reconciliation.netChangeInCash)}
              </div>
            </div>
          </div>
        )}

        {/* ── Detailed Financial Schedules ── */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            {t('loading')}
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            {t('noData')}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* 1. Operating Activities */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] font-semibold text-sm text-[var(--text-primary)] flex items-center justify-between">
                <span>{t('section1')}</span>
                <span className="font-mono font-bold text-sm">
                  ${fmt(data.operatingActivities.netCash)}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {data.operatingActivities.lines.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] italic" colSpan={2}>
                        {t('noOperating')}
                      </td>
                    </tr>
                  ) : (
                    data.operatingActivities.lines.map((line: api.CashFlowLineItemDto) => (
                      <tr key={line.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{line.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                          ${fmt(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-[var(--bg-secondary)]/50 font-bold">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {t('netOperating')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                      ${fmt(data.operatingActivities.netCash)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Investing Activities */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] font-semibold text-sm text-[var(--text-primary)] flex items-center justify-between">
                <span>{t('section2')}</span>
                <span className="font-mono font-bold text-sm">
                  ${fmt(data.investingActivities.netCash)}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {data.investingActivities.lines.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] italic" colSpan={2}>
                        {t('noInvesting')}
                      </td>
                    </tr>
                  ) : (
                    data.investingActivities.lines.map((line: api.CashFlowLineItemDto) => (
                      <tr key={line.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{line.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                          ${fmt(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-[var(--bg-secondary)]/50 font-bold">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {t('netInvesting')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                      ${fmt(data.investingActivities.netCash)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. Financing Activities */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] font-semibold text-sm text-[var(--text-primary)] flex items-center justify-between">
                <span>{t('section3')}</span>
                <span className="font-mono font-bold text-sm">
                  ${fmt(data.financingActivities.netCash)}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {data.financingActivities.lines.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] italic" colSpan={2}>
                        {t('noFinancing')}
                      </td>
                    </tr>
                  ) : (
                    data.financingActivities.lines.map((line: api.CashFlowLineItemDto) => (
                      <tr key={line.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{line.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                          ${fmt(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-[var(--bg-secondary)]/50 font-bold">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {t('netFinancing')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                      ${fmt(data.financingActivities.netCash)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Cash Reconciliation Schedule */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-900 text-white font-semibold text-sm flex items-center justify-between">
                <span>{t('section4')}</span>
                <span className="font-mono text-sm">
                  ${fmt(data.reconciliation.endingCash)}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  <tr className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {t('netOperatingFlow')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                      ${fmt(data.operatingActivities.netCash)}
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {t('netInvestingFlow')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                      ${fmt(data.investingActivities.netCash)}
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {t('netFinancingFlow')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                      ${fmt(data.financingActivities.netCash)}
                    </td>
                  </tr>
                  <tr className="bg-[var(--bg-secondary)] font-bold">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {t('netChange')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                      ${fmt(data.reconciliation.netChangeInCash)}
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {t('begCash')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                      ${fmt(data.reconciliation.beginningCash)}
                    </td>
                  </tr>
                  <tr className="bg-[var(--bg-secondary)]/80 font-bold">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {t('endCash')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      ${fmt(data.reconciliation.endingCash)}
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-hover)] text-xs text-[var(--text-muted)]">
                    <td className="px-4 py-2">{t('glBalance')}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      ${fmt(data.reconciliation.glCashBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DetailsLayout>
  );
}
