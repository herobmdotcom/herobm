'use client';

import { useState } from 'react';
import useSWR from 'swr';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { formatAmount } from '@/lib/currency';

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
  const [reportType, setReportType, reportTypeReady] = usePersistedSetting(
    'tax-balances-report-type',
    'generic',
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Date selection
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const activeReportType = (reportTypeReady ? reportType : 'generic') as api.TaxReportsControllerGetTaxReportReportType;

  const { data: reportData, isLoading, mutate } = useSWR(
    ['tax-report-summary', activeReportType, fromDate, toDate],
    async () => {
      const params: api.TaxReportsControllerGetTaxReportParams = {
        reportType: activeReportType,
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
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
  const totals = generic
    ? {
        salesBase: generic.categories.reduce((s, c) => s + (c.salesBase || 0), 0),
        outputTax: generic.totalOutputTax,
        purchaseBase: generic.categories.reduce((s, c) => s + (c.purchaseBase || 0), 0),
        inputTax: generic.totalInputTax,
        netTax: generic.netTaxLiability,
      }
    : { salesBase: 0, outputTax: 0, purchaseBase: 0, inputTax: 0, netTax: 0 };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2.5">
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

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
          From
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="text-sm px-2.5 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
          To
        </label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-sm px-2.5 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => mutate()}
        className="!py-1.5 !text-xs whitespace-nowrap"
      >
        Refresh
      </Button>
    </div>
  );

  return (
    <DetailsLayout
      showPrint={true}
      header={
        <EntityHeader
          title={reportData?.title || 'Tax Balances'}
          subtitle={
            reportData?.subtitle ||
            'Tax Liability & Statutory Reporting'
          }
          actions={headerActions}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Executive Summary Bar (Standard accounting KPI banner) ── */}
        {generic && (
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
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${getNetStatusBadgeClass(generic.netStatus as unknown as string)}`}>
                    {getNetStatusLabel(generic.netStatus as unknown as string)}
                  </span>
                </div>
                <span className={`text-lg font-bold font-mono mt-0.5 ${getNetPositionTextClass(generic.netTaxLiability)}`}>
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
        )}

        {/* ── Main Content Body ── */}
        {isLoading && !reportData ? (
          <div className="card p-12 text-center text-sm text-[var(--text-muted)] animate-pulse">
            Loading tax report data...
          </div>
        ) : isGenericView && generic ? (
          /* ── Generic View: Clean Standard Tax Category Schedule ── */
          <div className="card overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Tax Category
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Code
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Sales Base
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Output Tax
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Purchases Base
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Input Tax
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Net Tax
                  </th>
                </tr>
              </thead>
              <tbody>
                {generic.categories.map((cat) => (
                  <tr
                    key={cat.taxCategoryId}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                      {cat.title}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                      {cat.code}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                      {getTaxRateDisplay(cat.rate)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-primary)]">
                      {formatAmount(cat.salesBase, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {formatAmount(cat.outputTax, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-primary)]">
                      {formatAmount(cat.purchaseBase, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {formatAmount(cat.inputTax, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(cat.netTax, currency)}
                    </td>
                  </tr>
                ))}
                {generic.categories.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-[var(--text-muted)]"
                    >
                      No tax category data recorded for this period.
                    </td>
                  </tr>
                )}
                {/* Standard Totals Row */}
                {generic.categories.length > 0 && (
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td
                      colSpan={3}
                      className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(totals.salesBase, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(totals.outputTax, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(totals.purchaseBase, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(totals.inputTax, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formatAmount(totals.netTax, currency)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : !isGenericView && reportData?.boxes ? (
          /* ── Country Statutory View: Clean Box Schedule with 1-Click Copy ── */
          <div className="card overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider w-28">
                    Box / Line
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider w-36">
                    Section
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider w-40">
                    Amount (Copy)
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.boxes.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-xs text-[var(--text-primary)]">
                      {row.code || row.id}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.description}
                    </td>
                    <td className="px-4 py-3">
                      {row.section && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
                          {row.section}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleCopy(row.id, row.amount)}
                        className="font-mono text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded transition-all cursor-pointer"
                        title="Click to copy amount"
                      >
                        {getCopyButtonLabel(copiedId === row.id, row.amount)}
                      </Button>
                    </td>
                  </tr>
                ))}
                {reportData.boxes.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-[var(--text-muted)]"
                    >
                      No data available for this reporting period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DetailsLayout>
  );
}
