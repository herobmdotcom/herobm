'use client';

import { useState, useEffect, useCallback } from 'react';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import {
  userSettingsControllerGetSettings,
  userSettingsControllerUpdateSettings,
  businessReportsControllerGetReports,
} from '@herobm/sdk';
import { DEFAULT_ENABLED_EVENTS, EventType } from './TimelineSettingsSlideOver';

export interface PinnedReportItem {
  slug: string;
  configId: string;
  name?: string;
}

export function useDashboardData() {
  const [enabledEvents, setEnabledEvents] = useState<EventType[]>(DEFAULT_ENABLED_EVENTS);
  const [isLoaded, setIsLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are dynamic
  const [dashboardConfig, setDashboardConfig] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are dynamic
  const [userSettings, setUserSettings] = useState<Record<string, any> | null>(null);
  const [reports, setReports] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      userSettingsControllerGetSettings(),
      businessReportsControllerGetReports(),
    ]).then(([settingsResult, reportsResult]) => {
      if (!mounted) return;

      if (settingsResult.status === 'fulfilled') {
        const settings = settingsResult.value.data;
        setUserSettings(settings);
        setDashboardConfig(settings.dashboardConfig || {});
        if (settings.dashboardConfig?.timelineEvents) {
          setEnabledEvents(settings.dashboardConfig.timelineEvents as EventType[]);
        } else {
          setEnabledEvents(DEFAULT_ENABLED_EVENTS);
        }
      } else {
        reportError(settingsResult.reason, 'DashboardContent.userSettings');
        setEnabledEvents(DEFAULT_ENABLED_EVENTS);
      }

      if (reportsResult.status === 'fulfilled') {
        const reportsRes = reportsResult.value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are dynamic
        setReports(((reportsRes as unknown as Record<string, any>).data as { slug: string; name: string }[]) || (reportsRes as unknown as { slug: string; name: string }[]));
      } else {
        setReports([]);
      }

      setIsLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handlePreferencesChange = useCallback((events: EventType[]) => {
    setEnabledEvents(events);
    const updatedConfig = { ...dashboardConfig, timelineEvents: events };
    setDashboardConfig(updatedConfig);
    userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig })
      .then(() => {
        toast.success('Timeline preferences updated');
      })
      .catch((err: unknown) => {
        toast.error('Failed to save timeline preferences: ' + getErrorMessage(err));
        reportError(err, 'useDashboardData.handlePreferencesChange');
      });
  }, [dashboardConfig]);

  const handlePinnedReportsChange = useCallback((newPinnedReports: PinnedReportItem[]) => {
    const updatedConfig = { ...dashboardConfig, pinnedReports: newPinnedReports };
    setDashboardConfig(updatedConfig);
    userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig })
      .then(() => {
        toast.success('Pinned reports updated');
      })
      .catch((err: unknown) => {
        toast.error('Failed to save pinned reports: ' + getErrorMessage(err));
        reportError(err, 'useDashboardData.handlePinnedReportsChange');
      });
  }, [dashboardConfig]);

  return {
    isLoaded,
    enabledEvents,
    dashboardConfig,
    userSettings,
    reports,
    handlePreferencesChange,
    handlePinnedReportsChange,
  };
}
