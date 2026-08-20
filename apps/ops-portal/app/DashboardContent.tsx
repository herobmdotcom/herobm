'use client';

import { reportError } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/shared/Button';
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
    let mounted = true;

    Promise.allSettled([
      userSettingsControllerGetSettings(),
      businessReportsControllerGetReports()
    ]).then(([settingsResult, reportsResult]) => {
      if (!mounted) return;

      if (settingsResult.status === 'fulfilled') {
        const settings = settingsResult.value.data;
        setUserSettings(settings);
        setDashboardConfig(settings.dashboardConfig || {});
        if (settings.dashboardConfig?.timelineEvents) {
          setEnabledEvents(settings.dashboardConfig?.timelineEvents as EventType[]);
        } else {
          setEnabledEvents(DEFAULT_ENABLED_EVENTS);
        }
      } else {
        reportError(settingsResult.reason, 'DashboardContent.userSettings');
        setEnabledEvents(DEFAULT_ENABLED_EVENTS);
      }

      if (reportsResult.status === 'fulfilled') {
        const reportsRes = reportsResult.value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        setReports(((reportsRes as unknown as Record<string, any>).data as { slug: string; name: string }[]) || (reportsRes as unknown as { slug: string; name: string }[]));
      } else {
        // Expected if user does not have business report access
        setReports([]);
      }

      setIsLoaded(true);
    });

    return () => {
      mounted = false;
    };
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
                <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
                    {t('pinnedReports')}
                  </div>
                  <Button variant="ghost" 
                    onClick={() => setIsReportSettingsOpen(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                    title={t('managePinnedReports')}
                  >
                    { }
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">settings</span>
                  </Button>
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
              <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-4 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {t('quickActions.title')}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/sales-orders/new"
                  className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]"
                  >
                    { }
                    <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">request_quote</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
                      {t('quickActions.createQuote')}
                    </div>
                    <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createQuoteDesc')}>
                      {t('quickActions.createQuoteDesc')}
                    </div>
                  </div>
                </Link>

                <Link
                  href="/sales-orders/new"
                  className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]"
                  >
                    { }
                    <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">receipt_long</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
                      {t('quickActions.createSalesOrder')}
                    </div>
                    <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createSalesDesc')}>
                      {t('quickActions.createSalesDesc')}
                    </div>
                  </div>
                </Link>

                <Link
                  href="/purchase-orders/new"
                  className="group p-3.5 sm:p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] hover:border-[var(--accent)]/30 border flex items-center gap-3.5 cursor-pointer no-underline bg-[var(--bg-card)] border-[var(--border)]"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-[#006b5c]/[0.08]"
                  >
                    { }
                    <span className="material-symbols-outlined text-[22px] text-[var(--accent)]">local_shipping</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] group-hover:text-accent transition-colors text-[var(--text-primary)] leading-snug">
                      {t('quickActions.createPurchaseOrder')}
                    </div>
                    <div className="text-[12px] opacity-60 mt-0.5 truncate text-[var(--text-muted)] leading-tight" title={t('quickActions.createPurchaseDesc')}>
                      {t('quickActions.createPurchaseDesc')}
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="w-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  {tTimeline('title')}
                </div>
                
                <Button variant="ghost" 
                  onClick={() => setIsTimelineSettingsOpen(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                  title={tTimeline('settings')}
                >
                  { }
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">settings</span>
                </Button>
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
