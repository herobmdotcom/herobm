'use client';

import { useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
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

const REPORT_TEMPLATES = [
  { id: 'generic', name: 'Generic Tax Summary (Global)' },
  { id: 'au_bas', name: 'Australia — ATO BAS' },
  { id: 'uk_vat', name: 'United Kingdom — HMRC VAT Return (VAT 100)' },
  { id: 'sg_gst', name: 'Singapore — IRAS GST Form 5 (F5)' },
  { id: 'nz_gst', name: 'New Zealand — Inland Revenue GST 101' },
  { id: 'de_ustva', name: 'Germany / EU — USt-VA (Umsatzsteuer-Voranmeldung)' },
  { id: 'us_sales_tax', name: 'United States — Sales & Use Tax Summary' },
] as const;

function getNetStatusLabel(status?: string): string {
  if (status === 'payable') return 'Net Payable';
  if (status === 'refundable') return 'Refund Claim';
  return 'Settled';
}

function getCopyButtonLabel(isCopied: boolean, amount: number | null | undefined): string {
  if (isCopied) return 'Copied!';
  if (amount !== undefined && amount !== null) return amount.toString();
  return '0';
}

function getTaxRateDisplay(rate: string | number | null | undefined): string {
  if (rate !== null && rate !== undefined) return `${rate}%`;
  return '0%';
}

function getNetPositionTextClass(liability: number): string {
  if (liability > 0.001) return 'text-amber-500';
  if (liability < -0.001) return 'text-emerald-500';
  return 'text-[var(--text-primary)]';
}

function getNetStatusBadgeClass(status?: string): string {
  if (status === 'payable') return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
  if (status === 'refundable') return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
  return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
}

export default function TaxBalancesContent() {
  const tCommon = useTranslations('common');
  const tableRef = useRef<FinancialTableHandle>(null);

  const [reportType, setReportType, reportTypeReady] = usePersistedSetting(
    'tax-balances-report-type',
    'generic',
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const periodState = useFinancialReportPeriod({
    defaultMode: 'custom_range',
    supportedModes: ['fiscal_period', 'custom_range'],
  });

  const { mode, startDate, endDate, selectedPeriod } = periodState;

  const activeReportType = (reportTypeReady ? reportType : 'generic') as api.TaxReportsControllerGetTaxReportReportType;

  const { data: reportData, isLoading, mutate } = useSWR(
    ['tax-report-summary', activeReportType, startDate, endDate],
    async () => {
      const params: api.TaxReportsControllerGetTaxReportParams = {
        reportType: activeReportType,
      };
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const response = await api.taxReportsControllerGetTaxReport(params);
      return response.data;
    },
    {
      keepPreviousData: true,
      onError: (error) =>
        reportError(error, 'TaxBalancesContent_fetchTaxSummary'),
    },
  );

  const handleCopy = (id: string, amount: number | null | undefined) => {
    const val =
      amount !== undefined && amount !== null ? amount.toString() : '0';
    navigator.clipboard.writeText(val);
    toast.success(`Copied ${val} to clipboard`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currency = reportData?.genericSummary?.currencyCode || 'USD';
  const generic = reportData?.genericSummary;
  const isGenericView = activeReportType === 'generic';

  // Calculate table column totals for the generic schedule
  const totals: FinancialTableTotalRow = useMemo(() => {
    if (!generic) {
      return {
        label: 'Total',
        colSpanLabel: 3,
        values: {},
      };
    }
    const totalSalesBase = generic.categories.reduce((s, c) => s + (c.salesBase || 0), 0);
    const totalPurchaseBase = generic.categories.reduce((s, c) => s + (c.purchaseBase || 0), 0);

    return {
      label: 'Total',
      colSpanLabel: 3,
      values: {
        salesBase: formatAmount(totalSalesBase, currency),
        outputTax: formatAmount(generic.totalOutputTax, currency),
        purchaseBase: formatAmount(totalPurchaseBase, currency),
        inputTax: formatAmount(generic.totalInputTax, currency),
        netTax: formatAmount(generic.netTaxLiability, currency),
      },
      exportValues: {
        salesBase: totalSalesBase,
        outputTax: generic.totalOutputTax,
        purchaseBase: totalPurchaseBase,
        inputTax: generic.totalInputTax,
        netTax: generic.netTaxLiability,
      },
    };
  }, [generic, currency]);

  const genericColumns: FinancialTableColumn<api.TaxCategoryBreakdownDto>[] = useMemo(
    () => [
      {
        id: 'title',
        header: 'Tax Category',
        headerExportName: 'Tax Category',
        accessor: 'title',
        className: 'font-medium text-[var(--text-primary)]',
        exportValue: (r) => r.title,
      },
      {
        id: 'code',
        header: 'Code',
        headerExportName: 'Code',
        accessor: 'code',
        className: 'font-mono text-xs text-[var(--text-secondary)]',
        exportValue: (r) => r.code,
      },
      {
        id: 'rate',
        header: 'Rate',
        headerExportName: 'Rate',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {getTaxRateDisplay(r.rate)}
          </span>
        ),
        exportValue: (r) => (r.rate !== null && r.rate !== undefined ? `${r.rate}%` : '0%'),
      },
      {
        id: 'salesBase',
        header: 'Sales Base',
        headerExportName: 'Sales Base',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs text-[var(--text-primary)]">
            {formatAmount(r.salesBase, currency)}
          </span>
        ),
        exportValue: (r) => r.salesBase ?? 0,
      },
      {
        id: 'outputTax',
        header: 'Output Tax',
        headerExportName: 'Output Tax',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
            {formatAmount(r.outputTax, currency)}
          </span>
        ),
        exportValue: (r) => r.outputTax ?? 0,
      },
      {
        id: 'purchaseBase',
        header: 'Purchases Base',
        headerExportName: 'Purchases Base',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs text-[var(--text-primary)]">
            {formatAmount(r.purchaseBase, currency)}
          </span>
        ),
        exportValue: (r) => r.purchaseBase ?? 0,
      },
      {
        id: 'inputTax',
        header: 'Input Tax',
        headerExportName: 'Input Tax',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
            {formatAmount(r.inputTax, currency)}
          </span>
        ),
        exportValue: (r) => r.inputTax ?? 0,
      },
      {
        id: 'netTax',
        header: 'Net Tax',
        headerExportName: 'Net Tax',
        isNumeric: true,
        render: (r) => (
          <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
            {formatAmount(r.netTax, currency)}
          </span>
        ),
        exportValue: (r) => r.netTax ?? 0,
      },
    ],
    [currency],
  );

  const boxColumns: FinancialTableColumn<api.TaxReportBoxDto>[] = useMemo(
    () => [
      {
        id: 'code',
        header: 'Box / Line',
        headerExportName: 'Box / Line',
        width: '120px',
        className: 'font-mono font-bold text-xs text-[var(--text-primary)]',
        render: (r) => r.code || r.id,
        exportValue: (r) => r.code || r.id,
      },
      {
        id: 'description',
        header: 'Description',
        headerExportName: 'Description',
        accessor: 'description',
        className: 'text-[var(--text-secondary)]',
        exportValue: (r) => r.description,
      },
      {
        id: 'section',
        header: 'Section',
        headerExportName: 'Section',
        width: '140px',
        render: (r) =>
          r.section ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
              {r.section}
            </span>
          ) : null,
        exportValue: (r) => r.section || '',
      },
      {
        id: 'amount',
        header: 'Amount (Copy)',
        headerExportName: 'Amount',
        width: '160px',
        isNumeric: true,
        render: (r) => (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleCopy(r.id, r.amount)}
            className="font-mono text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded transition-all cursor-pointer"
            title="Click to copy amount"
          >
            {getCopyButtonLabel(copiedId === r.id, r.amount)}
          </Button>
        ),
        exportValue: (r) => r.amount ?? 0,
      },
    ],
    [copiedId],
  );

  const reportMetadata: FinancialReportMetadata = useMemo(
    () => ({
      title: reportData?.title || 'Tax Balances',
      subtitle: periodState.formattedSubtitle,
      period: mode === 'fiscal_period' ? selectedPeriod?.periodName : undefined,
      currency,
      extra: generic
        ? {
            'Total Output Tax (Sales)': formatAmount(generic.totalOutputTax, currency),
            'Total Input Tax (Purchases)': formatAmount(generic.totalInputTax, currency),
            'Net Tax Liability': formatAmount(generic.netTaxLiability, currency),
            'Net Position Status': getNetStatusLabel(generic.netStatus as unknown as string),
            'Total Turnover (Net Sales)': formatAmount(generic.totalNetSales, currency),
            'Total Purchases Base': formatAmount(generic.totalNetPurchases, currency),
          }
        : undefined,
    }),
    [reportData?.title, periodState.formattedSubtitle, mode, selectedPeriod, currency, generic],
  );

  return (
    <FinancialReportLayout
      title={reportData?.title || 'Tax Balances'}
      periodState={periodState}
      supportedModes={['fiscal_period', 'custom_range']}
      extraControls={
        <select
          value={activeReportType}
          onChange={(e) => setReportType(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] font-medium"
        >
          {REPORT_TEMPLATES.map((tmpl) => (
            <option key={tmpl.id} value={tmpl.id}>
              {tmpl.name}
            </option>
          ))}
        </select>
      }
      actions={
        <>
          <FinancialExportMenu
            onExportCsv={() => tableRef.current?.exportCsv()}
            onExportExcel={() => tableRef.current?.exportExcel()}
          />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => mutate()}
            className="!py-1.5 !text-xs whitespace-nowrap"
          >
            {tCommon('reporting.refresh')}
          </Button>
        </>
      }
      banner={
        generic && (
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-6 shadow-xs">
            <div className="flex flex-wrap items-center gap-8">
              {/* Output Tax */}
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Output Tax (Sales)
                </span>
                <span className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
                  {formatAmount(generic.totalOutputTax, currency)}
                </span>
              </div>

              <div className="hidden sm:block w-px h-8 bg-[var(--border)]" />

              {/* Input Tax */}
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Input Tax (Purchases)
                </span>
                <span className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
                  {formatAmount(generic.totalInputTax, currency)}
                </span>
              </div>

              <div className="hidden sm:block w-px h-8 bg-[var(--border)]" />

              {/* Net Position */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Net Position
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${getNetStatusBadgeClass(
                      generic.netStatus as unknown as string,
                    )}`}
                  >
                    {getNetStatusLabel(generic.netStatus as unknown as string)}
                  </span>
                </div>
                <span
                  className={`text-lg font-bold font-mono mt-0.5 ${getNetPositionTextClass(
                    generic.netTaxLiability,
                  )}`}
                >
                  {formatAmount(Math.abs(generic.netTaxLiability), currency)}
                </span>
              </div>
            </div>

            {/* Turnover base indicators */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-[var(--text-secondary)] border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Total Turnover (Net Sales)
                </span>
                <span className="font-semibold font-mono text-[var(--text-primary)]">
                  {formatAmount(generic.totalNetSales, currency)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                  Total Purchases Base
                </span>
                <span className="font-semibold font-mono text-[var(--text-primary)]">
                  {formatAmount(generic.totalNetPurchases, currency)}
                </span>
              </div>
            </div>
          </div>
        )
      }
    >
      {isGenericView && generic ? (
        <FinancialTable
          ref={tableRef}
          columns={genericColumns}
          data={generic.categories}
          totals={totals}
          keyExtractor={(cat) => cat.taxCategoryId}
          loading={isLoading && !reportData}
          loadingMessage="Loading tax report data..."
          emptyMessage="No tax category data recorded for this period."
          exportFileName={`tax-balances_${activeReportType}_${startDate}_${endDate}`}
          reportMetadata={reportMetadata}
        />
      ) : !isGenericView && reportData?.boxes ? (
        <FinancialTable
          ref={tableRef}
          columns={boxColumns}
          data={reportData.boxes}
          keyExtractor={(r) => r.id}
          loading={isLoading && !reportData}
          loadingMessage="Loading statutory tax return..."
          emptyMessage="No data available for this reporting period."
          exportFileName={`tax-return_${activeReportType}_${startDate}_${endDate}`}
          reportMetadata={reportMetadata}
        />
      ) : (
        <div className="card p-12 text-center text-sm text-[var(--text-muted)]">
          {isLoading ? (
            <span>Loading tax report data...</span>
          ) : (
            <span>No tax report data available for the selected period.</span>
          )}
        </div>
      )}
    </FinancialReportLayout>
  );
}

