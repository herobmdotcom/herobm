'use client';

import { reportError } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import UniversalSearch from '@/components/shared/UniversalSearch';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import DashboardTimeline from './DashboardTimeline';
import TimelineSettingsSlideOver, { DEFAULT_ENABLED_EVENTS, EventType } from './TimelineSettingsSlideOver';
import PinnedReportWidget from './PinnedReportWidget';
import ReportSettingsSlideOver from './ReportSettingsSlideOver';
import { userSettingsControllerGetSettings, userSettingsControllerUpdateSettings, businessReportsControllerGetReports } from '@herobm/sdk';

export default function DashboardContent() {
  const t = useTranslations('dashboard');
  const tTimeline = useTranslations('dashboard.timeline');
  const [isTimelineSettingsOpen, setIsTimelineSettingsOpen] = useState(false);
  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);
  const [enabledEvents, setEnabledEvents] = useState<EventType[]>(DEFAULT_ENABLED_EVENTS);
  const [isLoaded, setIsLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [dashboardConfig, setDashboardConfig] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [userSettings, setUserSettings] = useState<Record<string, any> | null>(null);
   
  const [reports, setReports] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      userSettingsControllerGetSettings(),
      businessReportsControllerGetReports()
    ]).then(([settingsRes, reportsRes]) => {
      const settings = settingsRes.data;
      setUserSettings(settings);
      setDashboardConfig(settings.dashboardConfig || {});
      if (settings.dashboardConfig?.timelineEvents) {
        setEnabledEvents(settings.dashboardConfig?.timelineEvents as EventType[]);
      } else {
        setEnabledEvents(DEFAULT_ENABLED_EVENTS);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      setReports(((reportsRes as unknown as Record<string, any>).data as { slug: string; name: string }[]) || (reportsRes as unknown as { slug: string; name: string }[]));
      setIsLoaded(true);
    }).catch((err: unknown) => {
      reportError(err, 'DashboardContent');
      setIsLoaded(true);
    });
  }, []);

  const handlePreferencesChange = (events: EventType[]) => {
    setEnabledEvents(events);
    const updatedConfig = { ...dashboardConfig, timelineEvents: events };
    setDashboardConfig(updatedConfig);
    try {
      userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig }).catch(console.warn);
    } catch (err) {
      console.warn('Failed to save timeline preferences', err);
    }
  };

  const handlePinnedReportsChange = (newPinnedReports: { slug: string; configId: string; name?: string }[]) => {
    const updatedConfig = { ...dashboardConfig, pinnedReports: newPinnedReports };
    setDashboardConfig(updatedConfig);
    try {
      userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig }).catch(console.warn);
    } catch (err) {
      console.warn('Failed to save pinned reports preferences', err);
    }
  };

  return (
    <>
      <div className="p-8 h-full overflow-y-auto lg:overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">{t('title')}</h2>
          
          <div className="mb-12">
            <UniversalSearch />
          </div>

          <div className="flex flex-col gap-12">
            {(Object.keys(userSettings?.reportConfigs || {}).length > 0 || dashboardConfig?.pinnedReports?.length > 0) && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
                    {t('pinnedReports')}
                  </div>
                  <button 
                    onClick={() => setIsReportSettingsOpen(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                    title={t('managePinnedReports')}
                  >
                    { }
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">settings</span>
                  </button>
                </div>
                
                {(!dashboardConfig?.pinnedReports || dashboardConfig.pinnedReports.length === 0) ? (
                  <div className="text-center p-8 border border-dashed rounded-xl opacity-50 text-[14px]">
                    {t('noPinnedReports')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {dashboardConfig?.pinnedReports?.map((report: { slug: string; configId: string; name?: string }, idx: number) => (
                      <PinnedReportWidget key={idx} slug={report.slug} configId={report.configId} name={report.name} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="w-full">
              <div className="flex items-center gap-2 mb-6 border-b pb-4 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {t('quickActions.title')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  href="/sales-orders/new"
                  className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover: border flex flex-col gap-5 cursor-pointer no-underline"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(0, 107, 92, 0.08)' }}
                  >
                    { }
                    <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent)' }}>receipt_long</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {t('quickActions.createSalesOrder')}
                    </div>
                    <div className="text-[13px] opacity-60 mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {t('quickActions.createSalesDesc')}
                    </div>
                  </div>
                </Link>

                <Link
                  href="/purchase-orders/new"
                  className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover: border flex flex-col gap-5 cursor-pointer no-underline"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(0, 107, 92, 0.08)' }}
                  >
                    { }
                    <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent)' }}>local_shipping</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {t('quickActions.createPurchaseOrder')}
                    </div>
                    <div className="text-[13px] opacity-60 mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {t('quickActions.createPurchaseDesc')}
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="w-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-primary)' }}>
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  {tTimeline('title')}
                </div>
                
                <button 
                  onClick={() => setIsTimelineSettingsOpen(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                  title={tTimeline('settings')}
                >
                  { }
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">settings</span>
                </button>
              </div>

              <div className="flex-1 min-h-[400px]">
                {isLoaded && <DashboardTimeline enabledEvents={enabledEvents} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoaded && (
        <>
          <TimelineSettingsSlideOver 
            isOpen={isTimelineSettingsOpen}
            onClose={() => setIsTimelineSettingsOpen(false)}
            enabledEvents={enabledEvents}
            onChange={handlePreferencesChange}
          />
          <ReportSettingsSlideOver
            isOpen={isReportSettingsOpen}
            onClose={() => setIsReportSettingsOpen(false)}
            reportConfigs={userSettings?.reportConfigs || {}}
            pinnedReports={dashboardConfig?.pinnedReports || []}
            reports={reports}
            onChange={handlePinnedReportsChange}
          />
        </>
      )}
    </>
  );
}
