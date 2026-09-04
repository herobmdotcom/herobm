'use client';

import React, { useState } from 'react';
import UniversalSearch from '@/components/shared/UniversalSearch';
import { useTranslations } from 'next-intl';
import TimelineSettingsSlideOver from './TimelineSettingsSlideOver';
import ReportSettingsSlideOver from './ReportSettingsSlideOver';
import SearchSettingsSlideOver from './SearchSettingsSlideOver';
import QuickActionsSettingsSlideOver from './QuickActionsSettingsSlideOver';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardPinnedReportsSection from './DashboardPinnedReportsSection';
import DashboardTimelineSection from './DashboardTimelineSection';
import DashboardTasksWidget from './DashboardTasksWidget';
import { useDashboardData } from './useDashboardData';

export default function DashboardContent() {
  const t = useTranslations('dashboard');
  const [isTimelineSettingsOpen, setIsTimelineSettingsOpen] = useState(false);
  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);
  const [isSearchSettingsOpen, setIsSearchSettingsOpen] = useState(false);
  const [isQuickActionsSettingsOpen, setIsQuickActionsSettingsOpen] = useState(false);

  const {
    isLoaded,
    enabledSearchEntities,
    quickActions,
    enabledEvents,
    dashboardConfig,
    userSettings,
    reports,
    handleSearchEntitiesChange,
    handleQuickActionsChange,
    handlePreferencesChange,
    handlePinnedReportsChange,
  } = useDashboardData();

  return (
    <>
      <div className="p-8 h-full overflow-y-auto lg:overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">{t('title')}</h2>

          <div className="mb-12">
            <UniversalSearch
              enabledEntities={enabledSearchEntities}
              onOpenSettings={() => setIsSearchSettingsOpen(true)}
            />
          </div>

          <div className="flex flex-col gap-12">
            <DashboardPinnedReportsSection
              pinnedReports={dashboardConfig?.pinnedReports}
              userSettings={userSettings}
              onOpenSettings={() => setIsReportSettingsOpen(true)}
            />

            <DashboardQuickActions
              quickActions={quickActions}
              onOpenSettings={() => setIsQuickActionsSettingsOpen(true)}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              <DashboardTasksWidget />
              <DashboardTimelineSection
                enabledEvents={enabledEvents}
                isLoaded={isLoaded}
                onOpenSettings={() => setIsTimelineSettingsOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {isLoaded && (
        <>
          <SearchSettingsSlideOver
            isOpen={isSearchSettingsOpen}
            onClose={() => setIsSearchSettingsOpen(false)}
            enabledEntities={enabledSearchEntities}
            onChange={handleSearchEntitiesChange}
          />
          <QuickActionsSettingsSlideOver
            isOpen={isQuickActionsSettingsOpen}
            onClose={() => setIsQuickActionsSettingsOpen(false)}
            quickActions={quickActions}
            onChange={handleQuickActionsChange}
          />
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
