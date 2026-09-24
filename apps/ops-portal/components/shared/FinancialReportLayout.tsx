'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import type {
  FinancialPeriodState,
  ReportMode,
} from '@/hooks/useFinancialReportPeriod';

export interface FinancialReportLayoutProps {
  /** Page or report title */
  title: React.ReactNode;
  /** Subtitle (defaults to formatted period/date summary) */
  subtitle?: React.ReactNode;
  /** Period and date range state from useFinancialReportPeriod() */
  periodState: FinancialPeriodState;
  /** List of reporting modes available for this report */
  supportedModes?: ReportMode[];
  /** Custom overrides for mode labels */
  modeLabels?: Partial<Record<ReportMode, string>>;
  /** Action buttons (e.g., Export CSV, PDF generator, Refresh) */
  actions?: React.ReactNode;
  /** Extra toolbar dropdowns/controls (e.g., Tax Template selector) */
  extraControls?: React.ReactNode;
  /** Top banner slot (e.g., Continuous Reconciliation verification banner, Drift warning, KPI summary) */
  banner?: React.ReactNode;
  /** Report contents (typically FinancialTable or reporting schedules) */
  children: React.ReactNode;
  /** Optional CSS class for content container */
  className?: string;
  /** Show print button */
  showPrint?: boolean;
}

export function FinancialReportLayout({
  title,
  subtitle,
  periodState,
  supportedModes = ['fiscal_period', 'custom_range'],
  modeLabels,
  actions,
  extraControls,
  banner,
  children,
  className = '',
  showPrint,
}: FinancialReportLayoutProps) {
  const t = useTranslations('common');

  const {
    periods,
    selectedPeriodId,
    selectedPeriod,
    mode,
    startDate,
    endDate,
    asOfDate,
    setMode,
    setPeriodId,
    setStartDate,
    setEndDate,
    setAsOfDate,
    formattedSubtitle,
  } = periodState;

  const defaultModeLabels: Record<ReportMode, string> = {
    fiscal_period: t('reporting.fiscalPeriod'),
    periodic: t('reporting.periodic'),
    custom_range: t('reporting.customRange'),
    point_in_time: t('reporting.pointInTime'),
  };

  const getPeriodLockBadge = (status?: string) => {
    if (status === 'hard_closed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
          <span className="material-symbols-outlined text-xs">lock</span>
          <span>{t('reporting.closedPeriod')}</span>
        </span>
      );
    }
    if (status === 'soft_locked') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
          <span className="material-symbols-outlined text-xs">lock_clock</span>
          <span>{t('reporting.softLocked')}</span>
        </span>
      );
    }
    return null;
  };

  const effectiveSubtitle = subtitle !== undefined ? subtitle : formattedSubtitle;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      {/* 1. Mode Selector (only if more than 1 mode supported) */}
      {supportedModes.length > 1 && (
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ReportMode)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
        >
          {supportedModes.map((m) => (
            <option key={m} value={m}>
              {modeLabels?.[m] || defaultModeLabels[m] || m}
            </option>
          ))}
        </select>
      )}

      {/* 2. Fiscal Period Dropdown & Lock Badge */}
      {mode === 'fiscal_period' && (
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriodId}
            onChange={(e) => setPeriodId(e.target.value)}
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

      {/* 3. Date Range Pickers (Periodic / Custom Range) */}
      {(mode === 'periodic' || mode === 'custom_range') && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
              {t('reporting.fromDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                if (e.target.validity.valid && e.target.value) {
                  setStartDate(e.target.value);
                }
              }}
              className="text-sm px-2.5 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
            />
          </div>
          <span className="text-xs text-[var(--text-muted)]">{t('reporting.toDate')}</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              if (e.target.validity.valid && e.target.value) {
                setEndDate(e.target.value);
              }
            }}
            className="text-sm px-2.5 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
          />
        </div>
      )}

      {/* 4. As Of Date Picker (Point in Time) */}
      {mode === 'point_in_time' && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            {t('reporting.asOfDate')}
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => {
              if (e.target.validity.valid && e.target.value) {
                setAsOfDate(e.target.value);
              }
            }}
            className="text-sm px-2.5 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
          />
        </div>
      )}

      {/* 5. Extra Custom Controls (e.g. Tax Template picker) */}
      {extraControls}

      {/* 6. Primary Action Buttons */}
      {actions}
    </div>
  );

  return (
    <DetailsLayout
      showPrint={showPrint}
      header={
        <EntityHeader
          title={title}
          subtitle={effectiveSubtitle}
          actions={headerActions}
        />
      }
    >
      <div className={`flex flex-col gap-6 ${className}`}>
        {/* Banner Slot */}
        {banner}

        {/* Report Content Body */}
        {children}
      </div>
    </DetailsLayout>
  );
}

export default FinancialReportLayout;
