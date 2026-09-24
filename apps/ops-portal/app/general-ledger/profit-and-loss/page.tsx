'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import {
  FinancialTable,
  FinancialTableColumn,
  FinancialTableSection,
  FinancialReportMetadata,
  FinancialTableHandle,
  FinancialTableTotalRow,
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

interface PnlTableRow {
  id: string;
  accountCode?: string;
  accountName: string;
  amount: number;
  ytdAmount?: number;
  isSummary?: boolean;
  isHighlight?: boolean;
}

export default function ProfitAndLossPage() {
  const t = useTranslations('gl.pnl');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));

  const tableRef = useRef<FinancialTableHandle>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<api.ProfitAndLossResponseDto | null>(null);

  const periodState = useFinancialReportPeriod({
    defaultMode: 'fiscal_period',
    supportedModes: ['fiscal_period', 'custom_range'],
  });

  const { startDate, endDate, selectedPeriodId, periods } = periodState;

  const fetchData = useCallback(() => {
    if (!startDate || !endDate) return;
    setLoading(true);

    const selectedPeriod = periods.find((p) => p.periodId === selectedPeriodId);

    api
      .glControllerGetProfitAndLoss({
        startDate,
        endDate,
        periodName: selectedPeriod?.periodName,
        fiscalYear: selectedPeriod?.fiscalYear,
        periodNumber: selectedPeriod?.periodNumber,
      })
      .then((res: { data: api.ProfitAndLossResponseDto }) => setData(res.data))
      .catch((err: unknown) => reportError(err, 'ProfitAndLossPage:getProfitAndLoss'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedPeriodId, periods]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: FinancialTableColumn<PnlTableRow>[] = useMemo(
    () => [
      {
        id: 'accountCode',
        header: 'Code',
        headerExportName: 'Account Code',
        width: '120px',
        render: (r) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {r.accountCode || ''}
          </span>
        ),
        exportValue: (r) => r.accountCode || '',
      },
      {
        id: 'accountName',
        header: t('account'),
        headerExportName: 'Account Name',
        render: (r) => (
          <span
            className={`${
              r.isHighlight
                ? 'font-bold text-[var(--text-primary)] text-sm'
                : r.isSummary
                ? 'font-semibold text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] font-medium'
            }`}
          >
            {r.accountName}
          </span>
        ),
        exportValue: (r) => r.accountName,
      },
      {
        id: 'amount',
        header: t('periodAmount'),
        headerExportName: 'Period Amount',
        isNumeric: true,
        width: '180px',
        render: (r) => {
          const isNegative = r.amount < 0;
          const textClass = r.isHighlight
            ? r.amount >= 0
              ? 'text-emerald-600 dark:text-emerald-400 font-bold text-sm'
              : 'text-[var(--danger)] font-bold text-sm'
            : isNegative
            ? 'text-[var(--danger)]'
            : 'text-[var(--text-primary)]';
          return (
            <span
              className={`font-mono ${
                r.isHighlight
                  ? 'font-bold'
                  : r.isSummary
                  ? 'font-semibold'
                  : 'font-medium'
              } ${textClass}`}
            >
              ${fmt(r.amount)}
            </span>
          );
        },
        exportValue: (r) => r.amount,
      },
      {
        id: 'ytdAmount',
        header: t('ytdAmount'),
        headerExportName: 'YTD Amount',
        isNumeric: true,
        width: '180px',
        render: (r) => {
          if (r.ytdAmount === undefined) return <span className="text-[var(--text-muted)]">-</span>;
          const isNegative = r.ytdAmount < 0;
          const textClass = r.isHighlight
            ? r.ytdAmount >= 0
              ? 'text-emerald-600 dark:text-emerald-400 font-bold text-sm'
              : 'text-[var(--danger)] font-bold text-sm'
            : isNegative
            ? 'text-[var(--danger)]'
            : 'text-[var(--text-primary)]';
          return (
            <span
              className={`font-mono ${
                r.isHighlight
                  ? 'font-bold'
                  : r.isSummary
                  ? 'font-semibold'
                  : 'font-medium'
              } ${textClass}`}
            >
              ${fmt(r.ytdAmount)}
            </span>
          );
        },
        exportValue: (r) => (r.ytdAmount !== undefined ? r.ytdAmount : ''),
      },
    ],
    [t],
  );

  const sections: FinancialTableSection<PnlTableRow>[] = useMemo(() => {
    if (!data) return [];

    const revLines = data.revenue.lines || [];
    const cogsLines = data.costOfGoodsSold.lines || [];
    const opexLines = data.operatingExpenses.lines || [];
    const otherLines = data.otherIncomeExpense.lines || [];

    const hasAnyLines =
      revLines.length > 0 ||
      cogsLines.length > 0 ||
      opexLines.length > 0 ||
      otherLines.length > 0;

    if (!hasAnyLines) {
      return [];
    }

    const result: FinancialTableSection<PnlTableRow>[] = [];

    // 1. Revenue Section
    result.push({
      id: 'sec-revenue',
      title: '1. ' + t('revenue'),
      exportTitle: 'Revenue',
      rows: revLines.map((l, i) => ({
        id: `rev-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.amount,
        ytdAmount: l.ytdAmount,
      })),
      subtotal: {
        label: t('totalRevenue'),
        values: {
          amount: `$${fmt(data.revenue.total)}`,
          ytdAmount: `$${fmt(data.revenue.ytdTotal || 0)}`,
        },
        exportValues: {
          amount: data.revenue.total,
          ytdAmount: data.revenue.ytdTotal,
        },
      },
    });

    // 2. Cost of Goods Sold Section
    result.push({
      id: 'sec-cogs',
      title: '2. ' + t('costOfGoodsSold'),
      exportTitle: 'Cost of Goods Sold',
      rows: cogsLines.map((l, i) => ({
        id: `cogs-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.amount,
        ytdAmount: l.ytdAmount,
      })),
      subtotal: {
        label: t('totalCogs'),
        values: {
          amount: `$${fmt(data.costOfGoodsSold.total)}`,
          ytdAmount: `$${fmt(data.costOfGoodsSold.ytdTotal || 0)}`,
        },
        exportValues: {
          amount: data.costOfGoodsSold.total,
          ytdAmount: data.costOfGoodsSold.ytdTotal,
        },
      },
    });

    // 3. Gross Profit Summary Row
    const ytdGrossProfit =
      (data.revenue.ytdTotal || 0) - (data.costOfGoodsSold.ytdTotal || 0);
    result.push({
      id: 'sec-gross-profit',
      title: undefined,
      exportTitle: 'Gross Profit',
      rows: [
        {
          id: 'gross-profit-row',
          accountName: `${t('grossProfit')} (${(
            data.summary.grossMarginPercentage || 0
          ).toFixed(1)}%)`,
          amount: data.summary.grossProfit,
          ytdAmount: ytdGrossProfit,
          isHighlight: true,
        },
      ],
      headerClassName: 'hidden',
    });

    // 4. Operating Expenses Section
    result.push({
      id: 'sec-opex',
      title: '3. ' + t('operatingExpenses'),
      exportTitle: 'Operating Expenses',
      rows: opexLines.map((l, i) => ({
        id: `opex-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.amount,
        ytdAmount: l.ytdAmount,
      })),
      subtotal: {
        label: t('totalOpex'),
        values: {
          amount: `$${fmt(data.operatingExpenses.total)}`,
          ytdAmount: `$${fmt(data.operatingExpenses.ytdTotal || 0)}`,
        },
        exportValues: {
          amount: data.operatingExpenses.total,
          ytdAmount: data.operatingExpenses.ytdTotal,
        },
      },
    });

    // 5. Operating Income (EBIT)
    const ytdOpex = data.operatingExpenses.ytdTotal || 0;
    const ytdOperatingIncome = ytdGrossProfit - ytdOpex;
    result.push({
      id: 'sec-operating-income',
      title: undefined,
      exportTitle: 'Operating Income',
      rows: [
        {
          id: 'operating-income-row',
          accountName: t('operatingIncome'),
          amount: data.summary.operatingIncome,
          ytdAmount: ytdOperatingIncome,
          isHighlight: true,
        },
      ],
      headerClassName: 'hidden',
    });

    // 6. Other Income & Expenses Section
    if (otherLines.length > 0 || data.otherIncomeExpense.total !== 0) {
      result.push({
        id: 'sec-other',
        title: '4. ' + t('otherIncomeExpense'),
        exportTitle: 'Other Income & Expenses',
        rows: otherLines.map((l, i) => ({
          id: `other-${l.accountCode || 'row'}-${i}`,
          accountCode: l.accountCode,
          accountName: l.accountName,
          amount: l.amount,
          ytdAmount: l.ytdAmount,
        })),
        subtotal: {
          label: t('totalOther'),
          values: {
            amount: `$${fmt(data.otherIncomeExpense.total)}`,
            ytdAmount: `$${fmt(data.otherIncomeExpense.ytdTotal || 0)}`,
          },
          exportValues: {
            amount: data.otherIncomeExpense.total,
            ytdAmount: data.otherIncomeExpense.ytdTotal,
          },
        },
      });
    }

    return result;
  }, [data, t]);

  const totals: FinancialTableTotalRow | undefined = useMemo(() => {
    if (!data) return undefined;
    const revLines = data.revenue.lines || [];
    const cogsLines = data.costOfGoodsSold.lines || [];
    const opexLines = data.operatingExpenses.lines || [];
    const otherLines = data.otherIncomeExpense.lines || [];

    const hasAnyLines =
      revLines.length > 0 ||
      cogsLines.length > 0 ||
      opexLines.length > 0 ||
      otherLines.length > 0;

    if (!hasAnyLines) {
      return undefined;
    }

    const ytdNet =
      (data.revenue.ytdTotal || 0) -
      (data.costOfGoodsSold.ytdTotal || 0) -
      (data.operatingExpenses.ytdTotal || 0) -
      (data.otherIncomeExpense.ytdTotal || 0);

    const isPositive = data.summary.netIncome >= 0;

    return {
      label: `${t('netIncome')} (${(data.summary.netMarginPercentage || 0).toFixed(
        1,
      )}%)`,
      exportLabel: 'Net Income / (Loss)',
      values: {
        amount: `$${fmt(data.summary.netIncome)}`,
        ytdAmount: `$${fmt(ytdNet)}`,
      },
      exportValues: {
        amount: data.summary.netIncome,
        ytdAmount: ytdNet,
      },
      className: isPositive
        ? 'text-emerald-600 dark:text-emerald-400 font-bold text-base'
        : 'text-[var(--danger)] font-bold text-base',
    };
  }, [data, t]);

  const reportMetadata: FinancialReportMetadata = useMemo(
    () => ({
      title: t('title'),
      subtitle: t('subtitle'),
      period: periodState.formattedSubtitle || `${startDate} to ${endDate}`,
      currency: 'USD',
      generatedAt: new Date().toLocaleString(),
    }),
    [t, periodState.formattedSubtitle, startDate, endDate],
  );

  return (
    <FinancialReportLayout
      title={t('title')}
      subtitle={t('subtitle')}
      periodState={periodState}
      supportedModes={['fiscal_period', 'custom_range']}
      actions={
        <FinancialExportMenu
          onExportCsv={() => tableRef.current?.exportCsv()}
          onExportExcel={() => tableRef.current?.exportExcel()}
        />
      }
      banner={
        data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {t('revenue')}
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)]">
                ${fmt(data.summary.totalRevenue)}
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)] font-mono">
                YTD: ${fmt(data.revenue.ytdTotal || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {t('grossProfit')}
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)]">
                ${fmt(data.summary.grossProfit)}
              </div>
              <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Margin: {(data.summary.grossMarginPercentage || 0).toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {t('operatingExpenses')}
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)]">
                ${fmt(data.summary.totalOperatingExpenses)}
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)] font-mono">
                YTD: ${fmt(data.operatingExpenses.ytdTotal || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {t('netIncome')}
              </div>
              <div
                className={`mt-1 text-xl font-bold font-mono ${
                  data.summary.netIncome >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-[var(--danger)]'
                }`}
              >
                ${fmt(data.summary.netIncome)}
              </div>
              <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Margin: {(data.summary.netMarginPercentage || 0).toFixed(1)}%
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
        totals={totals}
        keyExtractor={(r) => r.id}
        loading={loading}
        loadingMessage={t('loading')}
        emptyMessage={t('noData')}
        reportMetadata={reportMetadata}
        exportFileName={`Profit_And_Loss_${startDate}_${endDate}`}
        showExportButton={false}
      />
    </FinancialReportLayout>
  );
}
