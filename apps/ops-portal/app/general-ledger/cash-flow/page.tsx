'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import {
  FinancialTable,
  FinancialTableColumn,
  FinancialTableSection,
  FinancialReportMetadata,
  FinancialTableHandle,
} from '@/components/shared/FinancialTable';
import { FinancialReportLayout } from '@/components/shared/FinancialReportLayout';
import { FinancialExportMenu } from '@/components/shared/FinancialExportMenu';
import { useFinancialReportPeriod } from '@/hooks/useFinancialReportPeriod';

function fmt(amount: number): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNeg ? `(${formatted})` : formatted;
}

interface CashFlowTableRow {
  id: string;
  name: string;
  amount: number;
  isBold?: boolean;
  isGlBalance?: boolean;
  isDrilldownEligible?: boolean;
}

export default function CashFlowPage() {
  const t = useTranslations('gl.cashFlow');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));

  const tableRef = useRef<FinancialTableHandle>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [data, setData] = useState<api.CashFlowStatementResponseDto | null>(null);

  const periodState = useFinancialReportPeriod({
    defaultMode: 'fiscal_period',
    supportedModes: ['fiscal_period', 'custom_range'],
  });

  const { mode, startDate, endDate, selectedPeriodId, periods } = periodState;

  // Drilldown state
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [drilldownCache, setDrilldownCache] = useState<Record<string, api.CashFlowDrilldownResponseDto>>({});
  const [drilldownLoading, setDrilldownLoading] = useState<Record<string, boolean>>({});

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

  const columns: FinancialTableColumn<CashFlowTableRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: t('category'),
        headerExportName: 'Activity / Category',
        render: (r) => {
          if (r.isDrilldownEligible) {
            const isExpanded = !!expandedLines[r.id];
            return (
              <div className="flex items-center gap-2 font-medium">
                <span
                  className={`material-symbols-outlined text-base text-[var(--text-muted)] transition-transform duration-150 ${
                    isExpanded ? 'rotate-90 text-blue-600 dark:text-blue-400' : ''
                  }`}
                >
                  chevron_right
                </span>
                <span className={r.isBold ? 'font-bold text-[var(--text-primary)]' : ''}>{r.name}</span>
              </div>
            );
          }
          return (
            <span
              className={`${
                r.isBold
                  ? 'font-bold text-[var(--text-primary)]'
                  : r.isGlBalance
                  ? 'text-xs text-[var(--text-muted)]'
                  : 'text-[var(--text-secondary)] font-medium'
              }`}
            >
              {r.name}
            </span>
          );
        },
        exportValue: (r) => r.name,
      },
      {
        id: 'amount',
        header: t('amount'),
        headerExportName: 'Amount',
        isNumeric: true,
        render: (r) => {
          const isNegative = r.amount < 0;
          const isEmerald = r.id === 'rec-end' || (r.id === 'rec-change' && r.amount >= 0);
          const textClass = isNegative
            ? 'text-[var(--danger)]'
            : isEmerald
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-[var(--text-primary)]';
          return (
            <span
              className={`font-mono ${
                r.isBold ? 'font-bold text-sm' : r.isGlBalance ? 'text-xs text-[var(--text-muted)]' : 'font-medium'
              } ${textClass}`}
            >
              ${fmt(r.amount)}
            </span>
          );
        },
        exportValue: (r) => r.amount,
      },
    ],
    [expandedLines, t],
  );

  const sections: FinancialTableSection<CashFlowTableRow>[] = useMemo(() => {
    if (!data) return [];

    const sec1Rows: CashFlowTableRow[] = (data.operatingActivities?.lines || []).map((line) => ({
      id: line.id,
      name: line.name,
      amount: line.amount,
      isDrilldownEligible: true,
    }));

    const sec2Rows: CashFlowTableRow[] = (data.investingActivities?.lines || []).map((line) => ({
      id: line.id,
      name: line.name,
      amount: line.amount,
      isDrilldownEligible: true,
    }));

    const sec3Rows: CashFlowTableRow[] = (data.financingActivities?.lines || []).map((line) => ({
      id: line.id,
      name: line.name,
      amount: line.amount,
      isDrilldownEligible: true,
    }));

    const sec4Rows: CashFlowTableRow[] = [
      {
        id: 'rec-op',
        name: t('netOperatingFlow'),
        amount: data.operatingActivities.netCash,
      },
      {
        id: 'rec-inv',
        name: t('netInvestingFlow'),
        amount: data.investingActivities.netCash,
      },
      {
        id: 'rec-fin',
        name: t('netFinancingFlow'),
        amount: data.financingActivities.netCash,
      },
      {
        id: 'rec-change',
        name: t('netChange'),
        amount: data.reconciliation.netChangeInCash,
        isBold: true,
      },
      {
        id: 'rec-beg',
        name: t('begCash'),
        amount: data.reconciliation.beginningCash,
      },
      {
        id: 'rec-end',
        name: t('endCash'),
        amount: data.reconciliation.endingCash,
        isBold: true,
      },
      {
        id: 'rec-gl',
        name: t('glBalance'),
        amount: data.reconciliation.glCashBalance,
        isGlBalance: true,
      },
    ];

    return [
      {
        id: 'operating',
        title: t('section1'),
        exportTitle: t('section1'),
        rows: sec1Rows,
        subtotal: {
          label: t('netOperating'),
          exportLabel: t('netOperating'),
          values: {
            amount: `$${fmt(data.operatingActivities.netCash)}`,
          },
          exportValues: {
            amount: data.operatingActivities.netCash,
          },
        },
      },
      {
        id: 'investing',
        title: t('section2'),
        exportTitle: t('section2'),
        rows: sec2Rows,
        subtotal: {
          label: t('netInvesting'),
          exportLabel: t('netInvesting'),
          values: {
            amount: `$${fmt(data.investingActivities.netCash)}`,
          },
          exportValues: {
            amount: data.investingActivities.netCash,
          },
        },
      },
      {
        id: 'financing',
        title: t('section3'),
        exportTitle: t('section3'),
        rows: sec3Rows,
        subtotal: {
          label: t('netFinancing'),
          exportLabel: t('netFinancing'),
          values: {
            amount: `$${fmt(data.financingActivities.netCash)}`,
          },
          exportValues: {
            amount: data.financingActivities.netCash,
          },
        },
      },
      {
        id: 'reconciliation',
        title: t('section4'),
        exportTitle: t('section4'),
        rows: sec4Rows,
      },
    ];
  }, [data, t]);

  const reportMetadata: FinancialReportMetadata = useMemo(
    () => ({
      title: t('title'),
      period: mode === 'fiscal_period' ? periodState.selectedPeriod?.periodName : undefined,
      subtitle: periodState.formattedSubtitle,
      extra: data?.reconciliation
        ? {
            'Reconciliation Status': data.reconciliation.isReconciled
              ? 'Reconciled'
              : `Unreconciled (Drift: $${data.reconciliation.drift.toFixed(2)})`,
            'Beginning Cash': `$${data.reconciliation.beginningCash.toFixed(2)}`,
            'Net Period Change': `$${data.reconciliation.netChangeInCash.toFixed(2)}`,
            'Ending Cash': `$${data.reconciliation.endingCash.toFixed(2)}`,
          }
        : undefined,
    }),
    [mode, periodState.selectedPeriod, periodState.formattedSubtitle, data, t],
  );

  const renderExpandedRow = (row: CashFlowTableRow) => {
    if (!row.isDrilldownEligible) return null;
    const isLoading = !!drilldownLoading[row.id];
    const drilldown = drilldownCache[row.id];
    const txs = drilldown?.transactions || [];

    return (
      <div className="bg-[var(--bg-card)]/70 p-3 border-y border-[var(--border)]">
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
                  <td
                    className="py-1.5 px-3 text-[var(--text-secondary)] font-mono text-[11px] max-w-xs truncate"
                    title={tx.accountName}
                  >
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
        )}
      </div>
    );
  };

  return (
    <FinancialReportLayout
      title={t('title')}
      periodState={periodState}
      supportedModes={['fiscal_period', 'custom_range']}
      actions={
        <>
          <FinancialExportMenu
            onExportCsv={() => tableRef.current?.exportCsv()}
            onExportExcel={() => tableRef.current?.exportExcel()}
          />

          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="!py-1.5 !text-xs whitespace-nowrap"
          >
            {exportingPdf ? t('exporting') : t('exportPdf')}
          </Button>
        </>
      }
      banner={
        data && !data.reconciliation.isReconciled ? (
          <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {t('unreconciled')}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {`${t('unreconciledDesc')} (Drift: $${data.reconciliation.drift.toFixed(2)})`}
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
        ) : null
      }
    >
      <FinancialTable
        ref={tableRef}
        columns={columns}
        sections={sections}
        keyExtractor={(r) => r.id}
        loading={loading}
        loadingMessage={t('loading')}
        emptyMessage={t('noData')}
        exportFileName={`cash-flow_${mode === 'fiscal_period' ? (periodState.selectedPeriod?.periodName || 'period') : `${startDate}_${endDate}`}`}
        reportMetadata={reportMetadata}
        onRowClick={(r) => {
          if (r.isDrilldownEligible) {
            toggleLine(r.id);
          }
        }}
        isRowExpanded={(r) => !!expandedLines[r.id]}
        renderExpandedRow={renderExpandedRow}
      />
    </FinancialReportLayout>
  );
}
