/* eslint-disable */
// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { businessReportsControllerGetReports, businessReportsControllerRunReport } from '@modbm/sdk';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ReportChartViewer } from '@/components/reporting/ReportChartViewer';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function ReportViewer() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const gridRef = useRef<AgGridReact>(null);

  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [filteredChartData, setFilteredChartData] = useState<any[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'chart'>('grid');

  const syncGridDataToChart = useCallback(() => {
    if (gridRef.current?.api) {
      const currentData: any[] = [];
      gridRef.current.api.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) currentData.push(node.data);
      });
      setFilteredChartData(currentData);
    }
  }, []);

  useEffect(() => {
    businessReportsControllerGetReports()
      .then((res: Record<string, unknown>) => setReports((res.data as Record<string, unknown>[]) || (res as Record<string, unknown>[])))
      .catch(console.error);
  }, []);

  const report = reports?.find((r: any) => r.slug === slug);

  const fetchReportData = useCallback((overrideFilters?: Record<string, unknown>) => {
    if (!report) return;
    setIsLoadingData(true);
    setFilteredChartData(null);
    businessReportsControllerRunReport(slug, overrideFilters || filters)
      .then((res: Record<string, unknown>) => setReportData((res.data as Record<string, unknown>[]) || (res as Record<string, unknown>[])))
      .catch(console.error)
      .finally(() => setIsLoadingData(false));
  }, [report, slug, filters]);

  useEffect(() => {
    if (report) {
      fetchReportData();
    }
  }, [report]); // Only auto-fetch on first load when report is available

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const uiConfig = (report?.uiConfig as any) || {};
  const drillDownOptions = uiConfig.drillDownOptions || [];
  const selectedDrillDownId = filters['drillDown'];
  
  const dynamicColumns = useMemo(() => {
    let cols = [...(uiConfig.columns || [])];
    if (selectedDrillDownId) {
      const ddOpt = drillDownOptions.find((o: any) => o.id === selectedDrillDownId);
      if (ddOpt) {
        // Insert after the first column
        // Insert after the first column
        cols.splice(1, 0, ddOpt);
      }
    }
    return cols;
  }, [uiConfig.columns, selectedDrillDownId, drillDownOptions]);

  if (!report) return <div className="p-8">Loading report configuration...</div>;

  const salesReports = (reports || []).filter(r => r.slug.startsWith('sales-'));
  const financialReports = (reports || []).filter(r => !r.slug.startsWith('sales-'));

  const isSalesActive = slug.startsWith('sales-');
  const isFinancialActive = !slug.startsWith('sales-');

  const navSections = [
    {
      id: 'sales',
      label: 'Sales',
      isSubPage: true,
      isActive: isSalesActive,
      onClick: () => {
        if (salesReports.length > 0 && !isSalesActive) {
          router.push(`/reporting/${salesReports[0].slug}`);
        }
      },
      subtargets: salesReports.map(r => ({
        id: r.slug,
        label: r.name,
        isActive: r.slug === slug,
        onClick: () => router.push(`/reporting/${r.slug}`),
      }))
    },
    {
      id: 'financial',
      label: 'Financial',
      isSubPage: true,
      isActive: isFinancialActive,
      onClick: () => {
        if (financialReports.length > 0 && !isFinancialActive) {
          router.push(`/reporting/${financialReports[0].slug}`);
        }
      },
      subtargets: financialReports.map(r => ({
        id: r.slug,
        label: r.name,
        isActive: r.slug === slug,
        onClick: () => router.push(`/reporting/${r.slug}`),
      }))
    }
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={report.name}
          onBack={() => router.push('/reporting')}
          nav={<PageNav sections={navSections} />}
          actions={
            <div className="flex gap-2">
              <button 
                onClick={() => fetchReportData()}
                className="btn btn-primary"
              >
                Run Report
              </button>
              <button 
                onClick={() => gridRef.current?.api.exportDataAsCsv()}
                className="btn btn-secondary"
              >
                Export CSV
              </button>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col h-full bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden">
        {uiConfig.filters && uiConfig.filters.length > 0 && (
          <div className="flex flex-wrap gap-4 p-4 border-b border-[rgba(196,198,205,0.4)] bg-[#f2f4f6]">
            {uiConfig.filters.map((f: any) => (
              <div key={f.name} className="flex flex-col">
                <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                <input 
                  type={f.type} 
                  className="input max-w-xs"
                  value={(filters[f.name] as string) || ''}
                  onChange={(e) => setFilters({ ...filters, [f.name]: e.target.value })}
                />
              </div>
            ))}
            {drillDownOptions.length > 0 && (
              <div className="flex flex-col">
                <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Split By</label>
                <select
                  className="input max-w-xs"
                  value={(filters['drillDown'] as string) || ''}
                  onChange={(e) => {
                    const newFilters = { ...filters, drillDown: e.target.value };
                    setFilters(newFilters);
                    fetchReportData(newFilters);
                  }}
                >
                  <option value="">None</option>
                  {drillDownOptions.map((opt: any) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {uiConfig.chartConfig && (
              <div className="flex flex-col ml-auto">
                <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>View As</label>
                <div className="flex bg-white rounded-md border border-[rgba(196,198,205,0.4)] p-0.5">
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-[#f2f4f6] text-[var(--text-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    Table
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'chart' ? 'bg-[#f2f4f6] text-[var(--text-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                    onClick={() => setViewMode('chart')}
                  >
                    Chart
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 ag-theme-alpine-dark w-full min-h-0 relative">
          {isLoadingData ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <p className="font-medium text-[var(--text-muted)]">Loading data...</p>
            </div>
          ) : null}
          <div className={`h-full w-full ${viewMode === 'chart' ? 'hidden' : 'block'}`}>
            <AgGridReact
              ref={gridRef}
              rowData={Array.isArray(reportData) ? reportData : reportData?.data || []}
              columnDefs={dynamicColumns}
              defaultColDef={defaultColDef}
              animateRows={true}
              onFilterChanged={syncGridDataToChart}
              onSortChanged={syncGridDataToChart}
              onRowDataUpdated={syncGridDataToChart}
            />
          </div>
          {viewMode === 'chart' && (
            <div className="h-full w-full">
              <ReportChartViewer 
                data={filteredChartData || (Array.isArray(reportData) ? reportData : reportData?.data || [])}
                config={uiConfig.chartConfig}
                activeDrillDown={drillDownOptions.find((o: any) => o.id === selectedDrillDownId)}
              />
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
