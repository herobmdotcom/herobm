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

interface BalanceSheetTableRow {
  id: string;
  accountCode?: string;
  accountName: string;
  amount: number;
  movementMtd?: number;
  movementYtd?: number;
  movementLastYtd?: number;
  isSummary?: boolean;
  isHighlight?: boolean;
}

function renderAmountCell(
  val: number | undefined,
  isHighlight?: boolean,
  isSummary?: boolean,
) {
  if (val === undefined) return <span className="text-[var(--text-muted)]">-</span>;
  const isNegative = val < 0;
  const textClass = isHighlight
    ? 'text-[var(--text-primary)] font-bold text-sm'
    : isNegative
    ? 'text-[var(--danger)]'
    : 'text-[var(--text-primary)]';
  return (
    <span
      className={`font-mono ${
        isHighlight
          ? 'font-bold'
          : isSummary
          ? 'font-semibold'
          : 'font-medium'
      } ${textClass}`}
    >
      ${fmt(val)}
    </span>
  );
}

export default function BalanceSheetPage() {
  const t = useTranslations('gl.balanceSheet');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));

  const tableRef = useRef<FinancialTableHandle>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<api.BalanceSheetResponseDto | null>(null);

  const periodState = useFinancialReportPeriod({
    defaultMode: 'point_in_time',
    supportedModes: ['point_in_time', 'fiscal_period'],
  });

  const { asOfDate, selectedPeriodId, periods } = periodState;

  const fetchData = useCallback(() => {
    if (!asOfDate) return;
    setLoading(true);

    const selectedPeriod = periods.find((p) => p.periodId === selectedPeriodId);

    api
      .glControllerGetBalanceSheet({
        asOfDate,
        periodName: selectedPeriod?.periodName,
        fiscalYear: selectedPeriod?.fiscalYear,
      })
      .then((res: { data: api.BalanceSheetResponseDto }) => setData(res.data))
      .catch((err: unknown) => reportError(err, 'BalanceSheetPage:getBalanceSheet'))
      .finally(() => setLoading(false));
  }, [asOfDate, selectedPeriodId, periods]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: FinancialTableColumn<BalanceSheetTableRow>[] = useMemo(
    () => [
      {
        id: 'accountCode',
        header: 'Code',
        headerExportName: 'Account Code',
        width: '100px',
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
        header: t('amount'),
        headerExportName: 'Amount',
        isNumeric: true,
        width: '150px',
        render: (r) => renderAmountCell(r.amount, r.isHighlight, r.isSummary),
        exportValue: (r) => r.amount,
      },
      {
        id: 'movementMtd',
        header: t('movementMtd'),
        headerExportName: 'Movement MTD',
        isNumeric: true,
        width: '150px',
        render: (r) => renderAmountCell(r.movementMtd, r.isHighlight, r.isSummary),
        exportValue: (r) => (r.movementMtd !== undefined ? r.movementMtd : ''),
      },
      {
        id: 'movementYtd',
        header: t('movementYtd'),
        headerExportName: 'YTD',
        isNumeric: true,
        width: '150px',
        render: (r) => renderAmountCell(r.movementYtd, r.isHighlight, r.isSummary),
        exportValue: (r) => (r.movementYtd !== undefined ? r.movementYtd : ''),
      },
      {
        id: 'movementLastYtd',
        header: t('movementLastYtd'),
        headerExportName: 'Last YTD',
        isNumeric: true,
        width: '150px',
        render: (r) => renderAmountCell(r.movementLastYtd, r.isHighlight, r.isSummary),
        exportValue: (r) => (r.movementLastYtd !== undefined ? r.movementLastYtd : ''),
      },
    ],
    [t],
  );

  const sections: FinancialTableSection<BalanceSheetTableRow>[] = useMemo(() => {
    if (!data) return [];

    const curAssetLines = data.currentAssets.lines || [];
    const nonCurAssetLines = data.nonCurrentAssets.lines || [];
    const curLiabLines = data.currentLiabilities.lines || [];
    const nonCurLiabLines = data.nonCurrentLiabilities.lines || [];
    const eqLines = data.equity.lines || [];

    const hasAnyLines =
      curAssetLines.length > 0 ||
      nonCurAssetLines.length > 0 ||
      curLiabLines.length > 0 ||
      nonCurLiabLines.length > 0 ||
      eqLines.length > 0;

    if (!hasAnyLines) {
      return [];
    }

    const result: FinancialTableSection<BalanceSheetTableRow>[] = [];

    // 1. Current Assets Section
    result.push({
      id: 'sec-current-assets',
      title: '1. ' + t('currentAssets'),
      exportTitle: 'Current Assets',
      rows: curAssetLines.map((l, i) => ({
        id: `ca-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.balance,
        movementMtd: l.movementMtd,
        movementYtd: l.movementYtd,
        movementLastYtd: l.movementLastYtd,
      })),
      subtotal: {
        label: t('totalCurrentAssets'),
        values: {
          amount: `$${fmt(data.currentAssets.total)}`,
          movementMtd: `$${fmt(data.currentAssets.totalMovementMtd || 0)}`,
          movementYtd: `$${fmt(data.currentAssets.totalMovementYtd || 0)}`,
          movementLastYtd: `$${fmt(data.currentAssets.totalMovementLastYtd || 0)}`,
        },
        exportValues: {
          amount: data.currentAssets.total,
          movementMtd: data.currentAssets.totalMovementMtd || 0,
          movementYtd: data.currentAssets.totalMovementYtd || 0,
          movementLastYtd: data.currentAssets.totalMovementLastYtd || 0,
        },
      },
    });

    // 2. Non-Current Assets Section
    result.push({
      id: 'sec-non-current-assets',
      title: '2. ' + t('nonCurrentAssets'),
      exportTitle: 'Non-Current Assets',
      rows: nonCurAssetLines.map((l, i) => ({
        id: `nca-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.balance,
        movementMtd: l.movementMtd,
        movementYtd: l.movementYtd,
        movementLastYtd: l.movementLastYtd,
      })),
      subtotal: {
        label: t('totalNonCurrentAssets'),
        values: {
          amount: `$${fmt(data.nonCurrentAssets.total)}`,
          movementMtd: `$${fmt(data.nonCurrentAssets.totalMovementMtd || 0)}`,
          movementYtd: `$${fmt(data.nonCurrentAssets.totalMovementYtd || 0)}`,
          movementLastYtd: `$${fmt(data.nonCurrentAssets.totalMovementLastYtd || 0)}`,
        },
        exportValues: {
          amount: data.nonCurrentAssets.total,
          movementMtd: data.nonCurrentAssets.totalMovementMtd || 0,
          movementYtd: data.nonCurrentAssets.totalMovementYtd || 0,
          movementLastYtd: data.nonCurrentAssets.totalMovementLastYtd || 0,
        },
      },
    });

    // 3. Total Assets Summary Row
    result.push({
      id: 'sec-total-assets',
      title: undefined,
      exportTitle: 'Total Assets',
      rows: [
        {
          id: 'total-assets-row',
          accountName: t('totalAssets'),
          amount: data.validation.totalAssets,
          movementMtd: data.validation.totalAssetsMovementMtd,
          movementYtd: data.validation.totalAssetsMovementYtd,
          movementLastYtd: data.validation.totalAssetsMovementLastYtd,
          isHighlight: true,
        },
      ],
      headerClassName: 'hidden',
    });

    // 4. Current Liabilities Section
    result.push({
      id: 'sec-current-liabilities',
      title: '3. ' + t('currentLiabilities'),
      exportTitle: 'Current Liabilities',
      rows: curLiabLines.map((l, i) => ({
        id: `cl-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.balance,
        movementMtd: l.movementMtd,
        movementYtd: l.movementYtd,
        movementLastYtd: l.movementLastYtd,
      })),
      subtotal: {
        label: t('totalCurrentLiabilities'),
        values: {
          amount: `$${fmt(data.currentLiabilities.total)}`,
          movementMtd: `$${fmt(data.currentLiabilities.totalMovementMtd || 0)}`,
          movementYtd: `$${fmt(data.currentLiabilities.totalMovementYtd || 0)}`,
          movementLastYtd: `$${fmt(data.currentLiabilities.totalMovementLastYtd || 0)}`,
        },
        exportValues: {
          amount: data.currentLiabilities.total,
          movementMtd: data.currentLiabilities.totalMovementMtd || 0,
          movementYtd: data.currentLiabilities.totalMovementYtd || 0,
          movementLastYtd: data.currentLiabilities.totalMovementLastYtd || 0,
        },
      },
    });

    // 5. Non-Current Liabilities Section
    result.push({
      id: 'sec-non-current-liabilities',
      title: '4. ' + t('nonCurrentLiabilities'),
      exportTitle: 'Non-Current Liabilities',
      rows: nonCurLiabLines.map((l, i) => ({
        id: `ncl-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.balance,
        movementMtd: l.movementMtd,
        movementYtd: l.movementYtd,
        movementLastYtd: l.movementLastYtd,
      })),
      subtotal: {
        label: t('totalNonCurrentLiabilities'),
        values: {
          amount: `$${fmt(data.nonCurrentLiabilities.total)}`,
          movementMtd: `$${fmt(data.nonCurrentLiabilities.totalMovementMtd || 0)}`,
          movementYtd: `$${fmt(data.nonCurrentLiabilities.totalMovementYtd || 0)}`,
          movementLastYtd: `$${fmt(data.nonCurrentLiabilities.totalMovementLastYtd || 0)}`,
        },
        exportValues: {
          amount: data.nonCurrentLiabilities.total,
          movementMtd: data.nonCurrentLiabilities.totalMovementMtd || 0,
          movementYtd: data.nonCurrentLiabilities.totalMovementYtd || 0,
          movementLastYtd: data.nonCurrentLiabilities.totalMovementLastYtd || 0,
        },
      },
    });

    // 6. Total Liabilities Summary Row
    result.push({
      id: 'sec-total-liabilities',
      title: undefined,
      exportTitle: 'Total Liabilities',
      rows: [
        {
          id: 'total-liabilities-row',
          accountName: t('totalLiabilities'),
          amount: data.validation.totalLiabilities,
          movementMtd:
            (data.currentLiabilities.totalMovementMtd || 0) +
            (data.nonCurrentLiabilities.totalMovementMtd || 0),
          movementYtd:
            (data.currentLiabilities.totalMovementYtd || 0) +
            (data.nonCurrentLiabilities.totalMovementYtd || 0),
          movementLastYtd:
            (data.currentLiabilities.totalMovementLastYtd || 0) +
            (data.nonCurrentLiabilities.totalMovementLastYtd || 0),
          isHighlight: true,
        },
      ],
      headerClassName: 'hidden',
    });

    // 7. Equity Section (including current earnings)
    result.push({
      id: 'sec-equity',
      title: '5. ' + t('equity'),
      exportTitle: 'Equity',
      rows: eqLines.map((l, i) => ({
        id: `eq-${l.accountCode || 'row'}-${i}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        amount: l.balance,
        movementMtd: l.movementMtd,
        movementYtd: l.movementYtd,
        movementLastYtd: l.movementLastYtd,
      })),
      subtotal: {
        label: t('totalEquity'),
        values: {
          amount: `$${fmt(data.equity.total)}`,
          movementMtd: `$${fmt(data.equity.totalMovementMtd || 0)}`,
          movementYtd: `$${fmt(data.equity.totalMovementYtd || 0)}`,
          movementLastYtd: `$${fmt(data.equity.totalMovementLastYtd || 0)}`,
        },
        exportValues: {
          amount: data.equity.total,
          movementMtd: data.equity.totalMovementMtd || 0,
          movementYtd: data.equity.totalMovementYtd || 0,
          movementLastYtd: data.equity.totalMovementLastYtd || 0,
        },
      },
    });

    return result;
  }, [data, t]);

  const totals: FinancialTableTotalRow | undefined = useMemo(() => {
    if (!data) return undefined;
    const curAssetLines = data.currentAssets.lines || [];
    const nonCurAssetLines = data.nonCurrentAssets.lines || [];
    const curLiabLines = data.currentLiabilities.lines || [];
    const nonCurLiabLines = data.nonCurrentLiabilities.lines || [];
    const eqLines = data.equity.lines || [];

    const hasAnyLines =
      curAssetLines.length > 0 ||
      nonCurAssetLines.length > 0 ||
      curLiabLines.length > 0 ||
      nonCurLiabLines.length > 0 ||
      eqLines.length > 0;

    if (!hasAnyLines) {
      return undefined;
    }

    return {
      label: t('totalLiabilitiesAndEquity'),
      exportLabel: 'Total Liabilities & Equity',
      values: {
        amount: `$${fmt(data.validation.totalLiabilitiesAndEquity)}`,
        movementMtd: `$${fmt(
          data.validation.totalLiabilitiesAndEquityMovementMtd || 0,
        )}`,
        movementYtd: `$${fmt(
          data.validation.totalLiabilitiesAndEquityMovementYtd || 0,
        )}`,
        movementLastYtd: `$${fmt(
          data.validation.totalLiabilitiesAndEquityMovementLastYtd || 0,
        )}`,
      },
      exportValues: {
        amount: data.validation.totalLiabilitiesAndEquity,
        movementMtd:
          data.validation.totalLiabilitiesAndEquityMovementMtd || 0,
        movementYtd:
          data.validation.totalLiabilitiesAndEquityMovementYtd || 0,
        movementLastYtd:
          data.validation.totalLiabilitiesAndEquityMovementLastYtd || 0,
      },
      className: 'text-[var(--text-primary)] font-bold text-base',
    };
  }, [data, t]);

  const reportMetadata: FinancialReportMetadata = useMemo(
    () => ({
      title: t('title'),
      subtitle: t('subtitle'),
      asOfDate: asOfDate,
      currency: 'USD',
      generatedAt: new Date().toLocaleString(),
    }),
    [t, asOfDate],
  );

  return (
    <FinancialReportLayout
      title={t('title')}
      subtitle={t('subtitle')}
      periodState={periodState}
      supportedModes={['point_in_time', 'fiscal_period']}
      actions={
        <FinancialExportMenu
          onExportCsv={() => tableRef.current?.exportCsv()}
          onExportExcel={() => tableRef.current?.exportExcel()}
        />
      }
      banner={
        data ? (
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              data.validation.isBalanced
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  data.validation.isBalanced
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                }`}
              >
                {data.validation.isBalanced ? (
                  <span className="material-symbols-outlined text-xl">
                    verified
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-xl">
                    warning
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {data.validation.isBalanced
                    ? t('balanced')
                    : t('unbalanced')}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {data.validation.isBalanced
                    ? t('balancedDesc')
                    : `${t('unbalancedDesc')} (${t('drift')}: $${fmt(
                        data.validation.drift,
                      )})`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md font-medium border bg-[var(--surface-card)] border-[var(--border)] text-[var(--text-primary)]">
                {`${t('totalAssets')}: $${fmt(data.validation.totalAssets)}`}
              </span>
              <span className="text-[var(--text-muted)] font-sans">{'='}</span>
              <span className="px-2.5 py-1 rounded-md font-medium border bg-[var(--surface-card)] border-[var(--border)] text-[var(--text-primary)]">
                {`${t('totalLiabilities')}: $${fmt(data.validation.totalLiabilities)}`}
              </span>
              <span className="text-[var(--text-muted)] font-sans">{'+'}</span>
              <span className="px-2.5 py-1 rounded-md font-medium border bg-[var(--surface-card)] border-[var(--border)] text-[var(--text-primary)]">
                {`${t('totalEquity')}: $${fmt(data.validation.totalEquity)}`}
              </span>
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
        exportFileName={`Balance_Sheet_${asOfDate}`}
        showExportButton={false}
      />
    </FinancialReportLayout>
  );
}
