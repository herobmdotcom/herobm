'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
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

interface CashFlowSectionTableProps {
  title: string;
  netCash: number;
  lines: api.CashFlowLineItemDto[];
  emptyMessage: string;
  netLabel: string;
  expandedLines: Record<string, boolean>;
  drilldownCache: Record<string, api.CashFlowDrilldownResponseDto>;
  drilldownLoading: Record<string, boolean>;
  onToggleLine: (lineId: string) => void;
}

function CashFlowSectionTable({
  title,
  netCash,
  lines,
  emptyMessage,
  netLabel,
  expandedLines,
  drilldownCache,
  drilldownLoading,
  onToggleLine,
}: CashFlowSectionTableProps) {
  const t = useTranslations('gl.cashFlow');
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] font-semibold text-sm text-[var(--text-primary)] flex items-center justify-between">
        <span>{title}</span>
        <span className="font-mono font-bold text-sm">
          ${fmt(netCash)}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-[var(--border)]">
          {lines.length === 0 ? (
            <tr>
              <td className="px-4 py-3 text-xs text-[var(--text-muted)] italic" colSpan={2}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            lines.map((line: api.CashFlowLineItemDto) => {
              const isExpanded = !!expandedLines[line.id];
              const isLoading = !!drilldownLoading[line.id];
              const drilldown = drilldownCache[line.id];
              const txs = drilldown?.transactions || [];

              return (
                <Fragment key={line.id}>
                  <tr
                    onClick={() => onToggleLine(line.id)}
                    className="hover:bg-[var(--bg-hover)] cursor-pointer group transition-colors select-none"
                  >
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] flex items-center gap-2 font-medium">
                      <span
                        className={`material-symbols-outlined text-base text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-150 ${
                          isExpanded ? 'rotate-90 text-blue-600 dark:text-blue-400' : ''
                        }`}
                      >
                        chevron_right
                      </span>
                      <span>{line.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                      ${fmt(line.amount)}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[var(--bg-secondary)]/40 border-b border-[var(--border)]">
                      <td colSpan={2} className="p-0">
                        {isLoading ? (
                          <div className="py-4 px-8 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span className="material-symbols-outlined animate-spin text-sm">
                              progress_activity
                            </span>
                            <span>{t('loadingDrilldown')}</span>
                          </div>
                        ) : txs.length === 0 ? (
                          <div className="py-3 px-8 text-xs text-[var(--text-muted)] italic">
                            {t('noTransactions')}
                          </div>
                        ) : (
                          <div className="p-3 bg-[var(--bg-card)]/70 border-y border-[var(--border)]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                                  <th className="text-left font-semibold py-1.5 px-3">{t('date')}</th>
                                  <th className="text-left font-semibold py-1.5 px-3">{t('refNumber')}</th>
                                  <th className="text-left font-semibold py-1.5 px-3">{t('memo')}</th>
                                  <th className="text-left font-semibold py-1.5 px-3">{t('account')}</th>
                                  <th className="text-right font-semibold py-1.5 px-3">{t('cashImpact')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]/40">
                                {txs.map((tx, idx) => (
                                  <tr key={`${tx.journalEntryId}-${idx}`} className="hover:bg-[var(--bg-hover)]/70 transition-colors">
                                    <td className="py-1.5 px-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                                      {tx.entryDate}
                                    </td>
                                    <td className="py-1.5 px-3 font-mono whitespace-nowrap">
                                      <Link
                                        href={`/general-ledger/journal-entries?search=${encodeURIComponent(tx.entryNumber)}`}
                                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                        title={t('viewEntry')}
                                      >
                                        <span>{tx.entryNumber}</span>
                                        <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                      </Link>
                                    </td>
                                    <td className="py-1.5 px-3 text-[var(--text-primary)] max-w-xs truncate" title={tx.memo}>
                                      {tx.memo}
                                    </td>
                                    <td className="py-1.5 px-3 text-[var(--text-secondary)] font-mono text-[11px] max-w-xs truncate" title={tx.accountName}>
                                      {tx.accountCode ? `${tx.accountCode} - ${tx.accountName}` : tx.accountName}
                                    </td>
                                    <td
                                      className={`py-1.5 px-3 text-right font-mono font-medium whitespace-nowrap ${
                                        tx.allocatedCash < 0 ? 'text-[var(--danger)]' : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      ${fmt(tx.allocatedCash)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
          <tr className="bg-[var(--bg-secondary)]/50 font-bold border-t border-[var(--border)]">
            <td className="px-4 py-3 text-[var(--text-primary)]">
              {netLabel}
            </td>
            <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
              ${fmt(netCash)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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

  // Drilldown state
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [drilldownCache, setDrilldownCache] = useState<Record<string, api.CashFlowDrilldownResponseDto>>({});
  const [drilldownLoading, setDrilldownLoading] = useState<Record<string, boolean>>({});

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
    // Clear drilldown cache when date or period changes
    setExpandedLines({});
    setDrilldownCache({});

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

  const toggleLine = useCallback(
    (lineId: string) => {
      setExpandedLines((prev) => {
        const nextState = !prev[lineId];
        if (nextState && !drilldownCache[lineId] && !drilldownLoading[lineId]) {
          setDrilldownLoading((l) => ({ ...l, [lineId]: true }));
          api
            .glControllerGetCashFlowDrilldown({
              lineId,
              startDate,
              endDate,
            })
            .then((res: { data: api.CashFlowDrilldownResponseDto }) => {
              setDrilldownCache((c) => ({ ...c, [lineId]: res.data }));
            })
            .catch((err: unknown) => {
              reportError(err, `CashFlowPage:getDrilldown:${lineId}`);
              toast.error('Failed to load transaction drilldown');
            })
            .finally(() => {
              setDrilldownLoading((l) => ({ ...l, [lineId]: false }));
            });
        }
        return { ...prev, [lineId]: nextState };
      });
    },
    [drilldownCache, drilldownLoading, startDate, endDate],
  );

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
          subtitle={
            reportMode === 'fiscal_period' && selectedPeriodId
              ? `${periods.find((p) => p.periodId === selectedPeriodId)?.periodName || ''} (${startDate} ${t('to')} ${endDate})`
              : `${startDate} ${t('to')} ${endDate}`
          }
          actions={
            <div className="flex items-center gap-3">
              <select
                value={reportMode}
                onChange={(e) =>
                  setReportMode(e.target.value as 'fiscal_period' | 'custom_range')
                }
                className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
              >
                <option value="fiscal_period">{t('fiscalPeriod')}</option>
                <option value="custom_range">{t('customRange')}</option>
              </select>

              {reportMode === 'fiscal_period' && (
                <select
                  value={selectedPeriodId}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] font-medium"
                >
                  {periods.map((p) => (
                    <option key={p.periodId} value={p.periodId}>
                      {p.periodName} ({p.status.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              )}

              {reportMode === 'custom_range' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      if (e.target.validity.valid && e.target.value) {
                        setStartDate(e.target.value);
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">{t('to')}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      if (e.target.validity.valid && e.target.value) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg border outline-none bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="!py-1.5 !text-xs whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm mr-1">picture_as_pdf</span>
                {exportingPdf ? t('exporting') : t('exportPdf')}
              </Button>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Continuous Reconciliation Verification Banner */}
        {data && (
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              data.reconciliation.isReconciled
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  data.reconciliation.isReconciled
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{reconIcon}</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {data.reconciliation.isReconciled ? t('reconciled') : t('unreconciled')}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {data.reconciliation.isReconciled
                    ? t('reconciledDesc')
                    : `${t('unreconciledDesc')} (Drift: $${data.reconciliation.drift.toFixed(2)})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex flex-col items-end">
                <span className="text-[var(--text-muted)] uppercase text-[10px] font-sans">
                  {t('beginningCash')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  ${fmt(data.reconciliation.beginningCash)}
                </span>
              </div>
              <span className="text-[var(--text-muted)]">{'+'}</span>
              <div className="flex flex-col items-end">
                <span className="text-[var(--text-muted)] uppercase text-[10px] font-sans">
                  {t('netPeriodChange')}
                </span>
                <span
                  className={`font-bold ${
                    data.reconciliation.netChangeInCash < 0
                      ? 'text-[var(--danger)]'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  ${fmt(data.reconciliation.netChangeInCash)}
                </span>
              </div>
              <span className="text-[var(--text-muted)]">{'='}</span>
              <div className="flex flex-col items-end">
                <span className="text-[var(--text-muted)] uppercase text-[10px] font-sans">
                  {t('endingCash')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  ${fmt(data.reconciliation.endingCash)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Data Table */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-base">
              progress_activity
            </span>
            {t('loading')}
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">
            {t('noData')}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* 1. Operating Activities */}
            <CashFlowSectionTable
              title={t('section1')}
              netCash={data.operatingActivities.netCash}
              lines={data.operatingActivities.lines}
              emptyMessage={t('noOperating')}
              netLabel={t('netOperating')}
              expandedLines={expandedLines}
              drilldownCache={drilldownCache}
              drilldownLoading={drilldownLoading}
              onToggleLine={toggleLine}
            />

            {/* 2. Investing Activities */}
            <CashFlowSectionTable
              title={t('section2')}
              netCash={data.investingActivities.netCash}
              lines={data.investingActivities.lines}
              emptyMessage={t('noInvesting')}
              netLabel={t('netInvesting')}
              expandedLines={expandedLines}
              drilldownCache={drilldownCache}
              drilldownLoading={drilldownLoading}
              onToggleLine={toggleLine}
            />

            {/* 3. Financing Activities */}
            <CashFlowSectionTable
              title={t('section3')}
              netCash={data.financingActivities.netCash}
              lines={data.financingActivities.lines}
              emptyMessage={t('noFinancing')}
              netLabel={t('netFinancing')}
              expandedLines={expandedLines}
              drilldownCache={drilldownCache}
              drilldownLoading={drilldownLoading}
              onToggleLine={toggleLine}
            />

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
