'use client';

import React, { useState } from 'react';
import UniversalSearch from '@/components/shared/UniversalSearch';
import { useTranslations } from 'next-intl';
import TimelineSettingsSlideOver from './TimelineSettingsSlideOver';
import ReportSettingsSlideOver from './ReportSettingsSlideOver';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardPinnedReportsSection from './DashboardPinnedReportsSection';
import DashboardTimelineSection from './DashboardTimelineSection';
import { useDashboardData } from './useDashboardData';

export default function DashboardContent() {
  const t = useTranslations('dashboard');
  const [isTimelineSettingsOpen, setIsTimelineSettingsOpen] = useState(false);
  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);

  const {
    isLoaded,
    enabledEvents,
    dashboardConfig,
    userSettings,
    reports,
    handlePreferencesChange,
    handlePinnedReportsChange,
  } = useDashboardData();

  return (
    <>
      <div className="p-8 h-full overflow-y-auto lg:overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">{t('title')}</h2>

          <div className="mb-12">
            <UniversalSearch />
          </div>

          <div className="flex flex-col gap-12">
            <DashboardPinnedReportsSection
              pinnedReports={dashboardConfig?.pinnedReports}
              userSettings={userSettings}
              onOpenSettings={() => setIsReportSettingsOpen(true)}
            />

            <DashboardQuickActions />

            <DashboardTimelineSection
              enabledEvents={enabledEvents}
              isLoaded={isLoaded}
              onOpenSettings={() => setIsTimelineSettingsOpen(true)}
            />
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
