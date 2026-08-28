/* eslint-disable -- Highly dynamic reporting engine rendering requires bypassing strict linting */
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  businessReportsControllerGetReports,
  businessReportsControllerRunReport,
  userSettingsControllerGetSettings,
  userSettingsControllerUpdateSettings,
  BusinessReportResponseDto,
} from '@herobm/sdk';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ReportChartViewer } from '@/components/reporting/ReportChartViewer';
import { DateRangeFilter } from '@/components/reporting/DateRangeFilter';
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function ReportViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { slug } = useParams() as { slug: string };
  const configId = searchParams.get('configId');
  const [lastLoadedConfigId, setLastLoadedConfigId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const gridRef = useRef<AgGridReact>(null);

  const [reports, setReports] = useState<BusinessReportResponseDto[]>([]);
  const [reportData, setReportData] = useState<Record<string, unknown>[] | null>(null);
   
  const [filteredChartData, setFilteredChartData] = useState<any[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'chart'>('grid');

   
  const [userSettings, setUserSettings] = useState<Record<string, any> | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [pinToDashboard, setPinToDashboard] = useState(false);
  const loadedConfig = configId && userSettings ? (userSettings.reportConfigs?.[slug] || []).find((c: { id: string }) => c.id === configId) : null;

  useEffect(() => {
    userSettingsControllerGetSettings()
      .then((res) => setUserSettings(res.data))
      .catch((err) => toast.error('Failed to load user settings: ' + getErrorMessage(err)));
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

  const handleUnsaveView = async (idToUnsave: string) => {
    const currentReportConfigs = userSettings?.reportConfigs || {};
    const reportSaves = currentReportConfigs[slug] || [];
    
    const updatedConfigs = {
      ...currentReportConfigs,
       
      [slug]: reportSaves.filter((c: any) => c.id !== idToUnsave)
    };

    let updatedDashboard = userSettings?.dashboardConfig || {};
    const pinned = updatedDashboard.pinnedReports || [];
     
    if (pinned.some((p: any) => p.configId === idToUnsave)) {
      updatedDashboard = {
        ...updatedDashboard,
         
        pinnedReports: pinned.filter((p: any) => p.configId !== idToUnsave)
      };
    }

    try {
      const res = await userSettingsControllerUpdateSettings({
        reportConfigs: updatedConfigs,
        dashboardConfig: updatedDashboard
      });
      setUserSettings(res.data);
      router.push(`/reporting/${slug}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadView = (val: string) => {
    if (!val) return;
    const [targetSlug, configId] = val.split('|');
    router.push(`/reporting/${targetSlug}?configId=${configId}`);
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
      .then((res) => setReports(res.data))
      .catch((err) => toast.error('Failed to load reports: ' + getErrorMessage(err)));
  }, []);

   
  const report = reports?.find((r: any) => r.slug === slug);

  useDocumentTitle(
    report
      ? loadedConfig
        ? `${report.name} - ${loadedConfig.name}`
        : (report.name as string)
      : null,
  );

  const fetchReportData = useCallback((overrideFilters?: Record<string, unknown>) => {
    if (!report) return;
    setIsLoadingData(true);
    setFilteredChartData(null);
    businessReportsControllerRunReport(slug, { filters: overrideFilters || filters })
      .then((res) => setReportData(res.data))
      .catch((err) => toast.error('Failed to run report: ' + getErrorMessage(err)))
      .finally(() => setIsLoadingData(false));
  }, [report, slug, filters]);

  useEffect(() => {
    if (!report || !userSettings) return;

    const effectiveConfigId = configId || 'none';
    if (lastLoadedConfigId !== effectiveConfigId) {
      setLastLoadedConfigId(effectiveConfigId);
      
      if (configId) {
        const reportSaves = userSettings?.reportConfigs?.[slug] || [];
         
        const config = reportSaves.find((c: any) => c.id === configId);
        if (config) {
          setFilters(config.filters || {});
          setViewMode(config.viewMode || 'grid');
          fetchReportData(config.filters || {});
          return;
        }
      }
      
      setFilters({});
      fetchReportData({});
    }
  }, [report, userSettings, configId, slug, fetchReportData, lastLoadedConfigId]);

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

  const salesReports = (reports || []).filter((r: any) => r.slug.startsWith('sales-'));
  const warehouseReports = (reports || []).filter((r: any) => r.slug.startsWith('inventory-'));
  const purchasingReports = (reports || []).filter((r: any) => r.slug.startsWith('purchasing-'));
  const financialReports = (reports || []).filter((r: any) => !r.slug.startsWith('sales-') && !r.slug.startsWith('inventory-') && !r.slug.startsWith('purchasing-'));

  const isSalesActive = slug.startsWith('sales-');
  const isWarehouseActive = slug.startsWith('inventory-');
  const isPurchasingActive = slug.startsWith('purchasing-');
  const isFinancialActive = !isSalesActive && !isWarehouseActive && !isPurchasingActive;

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={loadedConfig ? `${report.name} - ${loadedConfig.name}` : (report.name as string)}
          nav={undefined}
          actions={
            <div className="flex items-center gap-2">
              <select 
                className="input max-w-[200px] text-sm h-8 !py-0"
                onChange={(e) => {
                  if (e.target.value) router.push(`/reporting/${e.target.value}`);
                }}
                value=""
              >
                <option value="" disabled>Load Standard View...</option>
                {warehouseReports.length > 0 && (
                  <optgroup label="Warehouse">
                    {warehouseReports.map((r: any) => <option key={r.slug} value={r.slug}>{r.name as string}</option>)}
                  </optgroup>
                )}
                {salesReports.length > 0 && (
                  <optgroup label="Sales">
                    {salesReports.map((r: any) => <option key={r.slug} value={r.slug}>{r.name as string}</option>)}
                  </optgroup>
                )}
                {purchasingReports.length > 0 && (
                  <optgroup label="Purchasing">
                    {purchasingReports.map((r: any) => <option key={r.slug} value={r.slug}>{r.name as string}</option>)}
                  </optgroup>
                )}
                {financialReports.length > 0 && (
                  <optgroup label="Financial">
                    {financialReports.map((r: any) => <option key={r.slug} value={r.slug}>{r.name as string}</option>)}
                  </optgroup>
                )}
              </select>
              <select 
                className="input max-w-[200px] text-sm h-8 !py-0"
                onChange={(e) => handleLoadView(e.target.value)}
                value=""
              >
                <option value="" disabled>Load Saved View...</option>
                {Object.entries(userSettings?.reportConfigs || {}).map(([rSlug, configs]) => {
                  const r = reports?.find(rep => rep.slug === rSlug);
                  const rName = r ? r.name : rSlug;
                   
                  if (!configs || (configs as any[]).length === 0) return null;
                  return (
                    <optgroup key={rSlug} label={rName as string}>
                      { }
                      {(configs as any[]).map((c) => (
                        <option key={c.id} value={`${rSlug}|${c.id}`}>{c.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {loadedConfig ? (
                <Button 
                  variant="secondary" size="sm" className="whitespace-nowrap h-8"
                  onClick={() => handleUnsaveView(loadedConfig.id)}
                >
                  Unsave View
                </Button>
              ) : (
                <Button 
                  variant="secondary" size="sm" className="whitespace-nowrap h-8"
                  onClick={() => setIsSavingView(true)}
                >
                  Save View
                </Button>
              )}
            </div>
          }
        />
      }
    >
      {isSavingView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
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
                <Button variant="secondary" onClick={() => setIsSavingView(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveView} disabled={!newViewName}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col h-full bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden">
        <div className="flex flex-wrap items-end gap-4 p-4 border-b border-[rgba(196,198,205,0.4)] bg-[#f2f4f6]">
          {uiConfig.filters && uiConfig.filters.length > 0 && (
            <>
              { }
              {uiConfig.filters.some((f: any) => f.name === 'fromDate') && uiConfig.filters.some((f: any) => f.name === 'toDate') && (
                <div className="flex flex-col">
                  <DateRangeFilter 
                     
                    value={(filters._dateRange || { mode: 'absolute', from: filters.fromDate, to: filters.toDate }) as any}
                    onChange={(val) => setFilters({ ...filters, _dateRange: val, fromDate: undefined, toDate: undefined })}
                  />
                </div>
              )}
              { }
              {uiConfig.filters.filter((f: any) => f.name !== 'fromDate' && f.name !== 'toDate').map((f: any) => (
                <div key={f.name} className="flex flex-col">
                  <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--text-muted)]">{f.label}</label>
                  <input 
                    type={f.type} 
                    className="input max-w-xs"
                    value={(filters[f.name] as string) || ''}
                    onChange={(e) => setFilters({ ...filters, [f.name]: e.target.value })}
                  />
                </div>
              ))}
            </>
          )}
          {drillDownOptions.length > 0 && (
            <div className="flex flex-col">
              <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--text-muted)]">Split By</label>
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
                { }
                {drillDownOptions.map((opt: any) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          
          {uiConfig.chartConfig && (
            <div className="flex flex-col">
              <label className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--text-muted)]">View As</label>
              <div className="flex bg-white rounded-md border border-[rgba(196,198,205,0.4)] p-0.5 h-[34px]">
                <Button
                  className={`px-3 flex items-center justify-center text-xs font-medium rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-[#f2f4f6] text-[var(--text-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                  onClick={() => setViewMode('grid')}
                >
                  Table
                </Button>
                <Button
                  className={`px-3 flex items-center justify-center text-xs font-medium rounded-sm transition-colors ${viewMode === 'chart' ? 'bg-[#f2f4f6] text-[var(--text-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                  onClick={() => setViewMode('chart')}
                >
                  Chart
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex items-end gap-3 ml-auto">
            <Button 
              variant="primary" className="h-[34px] !py-0 px-4"
              onClick={() => fetchReportData()}
            >
              Run Report
            </Button>
            <Button 
              variant="secondary" className="h-[34px] !py-0 px-4"
              onClick={() => gridRef.current?.api.exportDataAsCsv()}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex-1 ag-theme-alpine-dark w-full min-h-0 relative">
          {isLoadingData ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <p className="font-medium text-[var(--text-muted)]">Loading data...</p>
            </div>
          ) : null}
          <div className={`h-full w-full ${viewMode === 'chart' ? 'hidden' : 'block'}`}>
            <AgGridReact
              ref={gridRef}
              rowData={reportData || []}
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
                data={filteredChartData || reportData || []}
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
