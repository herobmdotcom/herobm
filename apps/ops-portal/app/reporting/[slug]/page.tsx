/* eslint-disable */
// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { businessReportsControllerGetReports, businessReportsControllerRunReport, userSettingsControllerGetSettings, userSettingsControllerUpdateSettings } from '@modbm/sdk';
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

  // modbm-allow-record-any
  const [userSettings, setUserSettings] = useState<Record<string, any> | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [pinToDashboard, setPinToDashboard] = useState(false);

  useEffect(() => {
    userSettingsControllerGetSettings()
      .then((res) => setUserSettings(res.data))
      .catch(console.error);
  }, []);

  const handleSaveView = async () => {
    if (!newViewName) return;
    const currentReportConfigs = userSettings?.reportConfigs || {};
    const reportSaves = currentReportConfigs[slug] || [];
    
    const newConfig = {
      id: crypto.randomUUID(),
      name: newViewName,
      filters,
      viewMode
    };

    const updatedConfigs = {
      ...currentReportConfigs,
      [slug]: [...reportSaves, newConfig]
    };

    let updatedDashboard = userSettings?.dashboardConfig || {};
    if (pinToDashboard) {
      const pinned = updatedDashboard.pinnedReports || [];
      if (!pinned.some((p: any) => p.configId === newConfig.id)) {
        updatedDashboard = {
          ...updatedDashboard,
          pinnedReports: [...pinned, { slug, configId: newConfig.id, name: `${report?.name} - ${newViewName}` }]
        };
      }
    }

    try {
      const res = await userSettingsControllerUpdateSettings({
        reportConfigs: updatedConfigs,
        ...(pinToDashboard && { dashboardConfig: updatedDashboard })
      });
      setUserSettings(res.data);
      setIsSavingView(false);
      setNewViewName('');
      setPinToDashboard(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadView = (configId: string) => {
    if (!configId) return;
    const reportSaves = userSettings?.reportConfigs?.[slug] || [];
    const config = reportSaves.find((c: any) => c.id === configId);
    if (config) {
      setFilters(config.filters || {});
      setViewMode(config.viewMode || 'grid');
      setTimeout(() => fetchReportData(config.filters || {}), 0);
    }
  };

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
  const warehouseReports = (reports || []).filter(r => r.slug.startsWith('inventory-'));
  const purchasingReports = (reports || []).filter(r => r.slug.startsWith('purchasing-'));
  const financialReports = (reports || []).filter(r => !r.slug.startsWith('sales-') && !r.slug.startsWith('inventory-') && !r.slug.startsWith('purchasing-'));

  const isSalesActive = slug.startsWith('sales-');
  const isWarehouseActive = slug.startsWith('inventory-');
  const isPurchasingActive = slug.startsWith('purchasing-');
  const isFinancialActive = !isSalesActive && !isWarehouseActive && !isPurchasingActive;

  const createSection = (id: string, label: string, isActive: boolean, sectionReports: any[]) => ({
    id,
    label,
    isSubPage: true,
    isActive,
    onClick: () => {
      if (sectionReports.length > 0 && !isActive) {
        router.push(`/reporting/${sectionReports[0].slug}`);
      }
    },
    subtargets: sectionReports.map(r => ({
      id: r.slug,
      label: r.name,
      isActive: r.slug === slug,
      onClick: () => router.push(`/reporting/${r.slug}`),
    }))
  });

  const navSections = [
    createSection('warehouse', 'Warehouse', isWarehouseActive, warehouseReports),
    createSection('sales', 'Sales', isSalesActive, salesReports),
    createSection('purchasing', 'Purchasing', isPurchasingActive, purchasingReports),
    createSection('financial', 'Financial', isFinancialActive, financialReports),
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
              {userSettings?.reportConfigs?.[slug]?.length > 0 && (
                <select 
                  className="input max-w-[150px] !py-1"
                  onChange={(e) => handleLoadView(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Load Saved View...</option>
                  {userSettings.reportConfigs[slug].map((c: { id: string, name: string, isDefault: boolean, columns: string[] }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button 
                onClick={() => setIsSavingView(true)}
                className="btn btn-secondary"
              >
                Save View
              </button>
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
      {isSavingView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Save Report View</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">View Name</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="e.g. Q1 Sales Summary"
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  autoFocus
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={pinToDashboard}
                  onChange={e => setPinToDashboard(e.target.checked)}
                />
                Pin this view to my Dashboard
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <button className="btn btn-secondary" onClick={() => setIsSavingView(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveView} disabled={!newViewName}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
