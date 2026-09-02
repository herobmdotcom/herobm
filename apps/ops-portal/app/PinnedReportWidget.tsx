'use client';

import { reportError } from '@/lib/api';
import { getErrorMessage } from '@herobm/shared';

import React, { useEffect, useState, useMemo } from 'react';
import { businessReportsControllerGetReports, businessReportsControllerRunReport, userSettingsControllerGetSettings } from '@herobm/sdk';
import { ReportChartViewer } from '@/components/reporting/ReportChartViewer';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

ModuleRegistry.registerModules([AllCommunityModule]);

interface PinnedReportWidgetProps {
  slug: string;
  configId: string;
  name?: string;
}

export default function PinnedReportWidget({ slug, configId, name }: PinnedReportWidgetProps) {
  const t = useTranslations('dashboard');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [reportConfig, setReportConfig] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [reportData, setReportData] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [uiConfig, setUiConfig] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPinnedData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        // Load report definition for uiConfig
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        const reports: any = await businessReportsControllerGetReports();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        const report = (reports.data || reports).find((r: any) => r.slug === slug);
        if (!report) throw new Error('Report not found');
        setUiConfig(report.uiConfig);

        // Load user settings for saved filters/viewMode
        const settingsRes = await userSettingsControllerGetSettings();
        const settings = settingsRes.data || settingsRes;
        const configsArray = (settings?.reportConfigs?.[slug] || []) as { id: string, filters?: Record<string, unknown> }[];
        const config = configsArray.find((c) => c.id === configId);
        
        if (!config) throw new Error('Config not found');
        setReportConfig(config);

        // Fetch data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        const dataRes: any = await businessReportsControllerRunReport(slug, { filters: config.filters || {} });
        setReportData(dataRes.data || dataRes);
      } catch (err) {
        setErrorMessage(getErrorMessage(err));
        reportError(err, 'PinnedReportWidget');
      } finally {
        setIsLoading(false);
      }
    }
    loadPinnedData();
  }, [slug, configId]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false, // simpler for dashboard widgets
  }), []);

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-[var(--bg-card)] border-[var(--border)] p-6 h-[400px] flex items-center justify-center">
        <span className="text-[var(--text-muted)] font-medium">{t('loadingReport')}</span>
      </div>
    );
  }

  if (errorMessage || !reportConfig || !uiConfig) {
    const displayError = errorMessage ? errorMessage : t('failedToLoadReport');
    return (
      <div className="rounded-2xl border bg-[var(--bg-card)] border-[var(--border)] p-6 h-[400px] flex items-center justify-center">
        <span className="text-red-500 font-medium text-sm">{displayError}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border flex flex-col overflow-hidden bg-[var(--bg-card)] border-[var(--border)] h-[400px]">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="font-bold text-[15px] truncate text-[var(--text-primary)]">
          {name || reportConfig.name || slug}
        </h3>
        <Link href={`/reporting/${slug}?configId=${configId}`} className="text-[var(--accent)] hover:underline text-xs font-bold uppercase tracking-wider">
          {t('viewFull')}
        </Link>
      </div>
      <div className="flex-1 min-h-0 relative p-4 w-full">
        {reportConfig.viewMode === 'chart' && uiConfig.chartConfig ? (
          <div className="w-full h-full">
            <ReportChartViewer 
              data={reportData}
              config={uiConfig.chartConfig}
              activeDrillDown={uiConfig.drillDownOptions?.find((o: { id: string }) => o.id === reportConfig.filters?.drillDown)}
            />
          </div>
        ) : (
          <div className="ag-theme-alpine-dark w-full h-full">
            <AgGridReact
              rowData={reportData}
              columnDefs={uiConfig.columns || []}
              defaultColDef={defaultColDef}
              animateRows={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
