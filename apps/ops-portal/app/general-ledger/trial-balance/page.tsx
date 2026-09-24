'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import {
  FinancialTable,
  FinancialTableColumn,
  FinancialTableTotalRow,
  FinancialReportMetadata,
  FinancialTableHandle,
} from '@/components/shared/FinancialTable';
import { FinancialReportLayout } from '@/components/shared/FinancialReportLayout';
import { FinancialExportMenu } from '@/components/shared/FinancialExportMenu';
import { useFinancialReportPeriod } from '@/hooks/useFinancialReportPeriod';

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
  const tableRef = useRef<FinancialTableHandle>(null);

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!n || n === 0) return tCommon('na');
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const periodState = useFinancialReportPeriod({
    defaultMode: 'point_in_time',
  });

  const { mode, startDate, asOfDate, selectedPeriodId, periods } = periodState;

  const [rows, setRows] = useState<api.TrialBalanceResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconReport, setReconReport] =
    useState<api.SubledgerReconciliationResponseDto | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

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

  // Load continuous subledger reconciliation
  useEffect(() => {
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
      mode === 'periodic' || mode === 'fiscal_period'
        ? { asOfDate, periodStart: startDate }
        : { asOfDate };

    api
      .glControllerGetTrialBalance(params)
      .then((res) => setRows(res.data))
      .catch((err) => reportError(err, 'TrialBalancePage'))
      .finally(() => setLoading(false));
  }, [asOfDate, startDate, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPeriodDebit = rows.reduce((s, r) => s + (r.periodDebit || 0), 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + (r.periodCredit || 0), 0);
  const totalOpening = rows.reduce((s, r) => s + (r.openingBalance || 0), 0);
  const totalClosing = rows.reduce((s, r) => s + (r.closingBalance || 0), 0);
  const totalYtd = rows.reduce((s, r) => s + (r.ytdBalance || 0), 0);
  const totalYtdDebit = rows.reduce((s, r) => s + (r.ytdDebit || 0), 0);
  const totalYtdCredit = rows.reduce((s, r) => s + (r.ytdCredit || 0), 0);

  const columns: FinancialTableColumn<api.TrialBalanceResponseDto>[] = useMemo(() => {
    const baseCols: FinancialTableColumn<api.TrialBalanceResponseDto>[] = [
      {
        id: 'accountCode',
        header: t('columns.accountCode'),
        accessor: 'accountCode',
        className: 'font-mono text-xs text-[var(--text-secondary)]',
        exportValue: (r) => r.accountCode,
      },
      {
        id: 'name',
        header: t('columns.accountName'),
        accessor: 'name',
        className: 'font-medium text-[var(--text-primary)]',
        exportValue: (r) => r.name,
      },
      {
        id: 'accountType',
        header: t('columns.accountType'),
        accessor: 'accountType',
        render: (r) => typeBadge(r.accountType),
        exportValue: (r) => r.accountType,
      },
    ];

    if (mode === 'periodic' || mode === 'fiscal_period') {
      return [
        ...baseCols,
        {
          id: 'openingBalance',
          header: t('columns.openingBalance'),
          isNumeric: true,
          render: (r) => (
            <span className={r.openingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}>
              {fmt(r.openingBalance)}
            </span>
          ),
          exportValue: (r) => r.openingBalance ?? 0,
        },
        {
          id: 'periodDebit',
          header: t('columns.periodDebit'),
          isNumeric: true,
          render: (r) => fmt(r.periodDebit),
          exportValue: (r) => r.periodDebit ?? 0,
        },
        {
          id: 'periodCredit',
          header: t('columns.periodCredit'),
          isNumeric: true,
          render: (r) => fmt(r.periodCredit),
          exportValue: (r) => r.periodCredit ?? 0,
        },
        {
          id: 'closingBalance',
          header: t('columns.closingBalance'),
          isNumeric: true,
          render: (r) => (
            <span className={`font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
              {fmt(r.closingBalance)}
            </span>
          ),
          exportValue: (r) => r.closingBalance ?? 0,
        },
        {
          id: 'ytdDebit',
          header: t('columns.ytdDebit'),
          isNumeric: true,
          render: (r) => fmt(r.ytdDebit),
          exportValue: (r) => r.ytdDebit ?? 0,
        },
        {
          id: 'ytdCredit',
          header: t('columns.ytdCredit'),
          isNumeric: true,
          render: (r) => fmt(r.ytdCredit),
          exportValue: (r) => r.ytdCredit ?? 0,
        },
        {
          id: 'ytdBalance',
          header: t('columns.ytdBalance'),
          isNumeric: true,
          render: (r) => (
            <span className={`font-semibold ${r.ytdBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
              {fmt(r.ytdBalance)}
            </span>
          ),
          exportValue: (r) => r.ytdBalance ?? 0,
        },
      ];
    }

    return [
      ...baseCols,
      {
        id: 'periodDebit',
        header: t('columns.debit'),
        isNumeric: true,
        render: (r) => fmt(r.periodDebit),
        exportValue: (r) => r.periodDebit ?? 0,
      },
      {
        id: 'periodCredit',
        header: t('columns.credit'),
        isNumeric: true,
        render: (r) => fmt(r.periodCredit),
        exportValue: (r) => r.periodCredit ?? 0,
      },
      {
        id: 'closingBalance',
        header: t('columns.balance'),
        isNumeric: true,
        render: (r) => (
          <span className={`font-semibold ${r.closingBalance < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}>
            {fmt(r.closingBalance)}
          </span>
        ),
        exportValue: (r) => r.closingBalance ?? 0,
      },
    ];
  }, [mode, t]);

  const totals: FinancialTableTotalRow = useMemo(() => {
    if (mode === 'periodic' || mode === 'fiscal_period') {
      return {
        label: t('totals'),
        colSpanLabel: 3,
        values: {
          openingBalance: fmt(totalOpening),
          periodDebit: fmt(totalPeriodDebit),
          periodCredit: fmt(totalPeriodCredit),
          closingBalance: fmt(totalClosing),
          ytdDebit: fmt(totalYtdDebit),
          ytdCredit: fmt(totalYtdCredit),
          ytdBalance: fmt(totalYtd),
        },
        exportValues: {
          openingBalance: totalOpening,
          periodDebit: totalPeriodDebit,
          periodCredit: totalPeriodCredit,
          closingBalance: totalClosing,
          ytdDebit: totalYtdDebit,
          ytdCredit: totalYtdCredit,
          ytdBalance: totalYtd,
        },
      };
    }

    return {
      label: t('totals'),
      colSpanLabel: 3,
      values: {
        periodDebit: fmt(totalPeriodDebit),
        periodCredit: fmt(totalPeriodCredit),
        closingBalance: fmt(totalClosing),
      },
      exportValues: {
        periodDebit: totalPeriodDebit,
        periodCredit: totalPeriodCredit,
        closingBalance: totalClosing,
      },
    };
  }, [
    mode,
    t,
    totalOpening,
    totalPeriodDebit,
    totalPeriodCredit,
    totalClosing,
    totalYtdDebit,
    totalYtdCredit,
    totalYtd,
  ]);

  const reportMetadata: FinancialReportMetadata = useMemo(() => {
    return {
      title: t('title'),
      period: mode === 'fiscal_period' ? periodState.selectedPeriod?.periodName : undefined,
      asOfDate: mode !== 'fiscal_period' ? asOfDate : undefined,
      subtitle: periodState.formattedSubtitle,
    };
  }, [mode, periodState.selectedPeriod, asOfDate, periodState.formattedSubtitle, t]);

  return (
    <FinancialReportLayout
      title={t('title')}
      periodState={periodState}
      supportedModes={['point_in_time', 'periodic', 'fiscal_period']}
      actions={
        <>
          <FinancialExportMenu
            onExportCsv={() => tableRef.current?.exportCsv()}
            onExportExcel={() => tableRef.current?.exportExcel()}
          />

          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportPeriodClosePdf}
            disabled={exportingPdf}
            className="!py-1.5 !text-xs whitespace-nowrap"
          >
            {exportingPdf ? t('exporting') : t('exportAuditPdf')}
          </Button>
        </>
      }
      banner={
        reconReport && (
          <div className={getBannerClasses(reconReport.isOverallBalanced)}>
            <div className="flex items-center gap-3">
              <div className={getIconBoxClasses(reconReport.isOverallBalanced)}>
                <span className="material-symbols-outlined">
                  {getReconIconName(reconReport.isOverallBalanced)}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {reconReport.isOverallBalanced
                    ? t('subledgerReconAllBalanced')
                    : t('subledgerReconDiscrepancy')}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('zeroSumNet')}: $
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
        )
      }
    >
      <FinancialTable
        ref={tableRef}
        columns={columns}
        data={rows}
        totals={totals}
        keyExtractor={(r) => r.accountCode}
        loading={loading}
        loadingMessage={tGeneral('loading')}
        emptyMessage={t('noData')}
        exportFileName={`trial-balance_${mode === 'fiscal_period' ? (periodState.selectedPeriod?.periodName || 'period') : asOfDate}`}
        reportMetadata={reportMetadata}
      />
    </FinancialReportLayout>
  );
}

