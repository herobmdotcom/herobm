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
import { DEFAULT_SEARCH_ENTITIES } from './SearchSettingsSlideOver';
import {
  DEFAULT_QUICK_ACTIONS,
  QuickActionItem,
} from './QuickActionsSettingsSlideOver';
import {
  DEFAULT_ENABLED_EVENTS,
  EventType,
} from './TimelineSettingsSlideOver';

export interface PinnedReportItem {
  slug: string;
  configId: string;
  name?: string;
}

export function useDashboardData() {
  const [enabledSearchEntities, setEnabledSearchEntities] =
    useState<string[]>(DEFAULT_SEARCH_ENTITIES);
  const [quickActions, setQuickActions] =
    useState<QuickActionItem[]>(DEFAULT_QUICK_ACTIONS);
  const [enabledEvents, setEnabledEvents] =
    useState<EventType[]>(DEFAULT_ENABLED_EVENTS);
  const [isLoaded, setIsLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic user settings structure
  const [dashboardConfig, setDashboardConfig] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic user settings structure
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
        const config = settings.dashboardConfig || {};
        setDashboardConfig(config);

        if (config.searchEntities && Array.isArray(config.searchEntities)) {
          setEnabledSearchEntities(config.searchEntities);
        } else {
          setEnabledSearchEntities(DEFAULT_SEARCH_ENTITIES);
        }

        if (config.quickActions && Array.isArray(config.quickActions)) {
          setQuickActions(config.quickActions);
        } else {
          setQuickActions(DEFAULT_QUICK_ACTIONS);
        }

        if (config.timelineEvents && Array.isArray(config.timelineEvents)) {
          setEnabledEvents(config.timelineEvents as EventType[]);
        } else {
          setEnabledEvents(DEFAULT_ENABLED_EVENTS);
        }
      } else {
        reportError(settingsResult.reason, 'DashboardContent.userSettings');
        setEnabledSearchEntities(DEFAULT_SEARCH_ENTITIES);
        setQuickActions(DEFAULT_QUICK_ACTIONS);
        setEnabledEvents(DEFAULT_ENABLED_EVENTS);
      }

      if (reportsResult.status === 'fulfilled') {
        const reportsRes = reportsResult.value;
        setReports(
          ((reportsRes as unknown as Record<string, unknown>)?.data as {
            slug: string;
            name: string;
          }[]) || (reportsRes as unknown as { slug: string; name: string }[]),
        );
      } else {
        setReports([]);
      }

      setIsLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSearchEntitiesChange = useCallback(
    (entities: string[]) => {
      setEnabledSearchEntities(entities);
      const updatedConfig = { ...dashboardConfig, searchEntities: entities };
      setDashboardConfig(updatedConfig);
      userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig })
        .then(() => {
          toast.success('Search preferences updated');
        })
        .catch((err: unknown) => {
          toast.error('Failed to save search preferences: ' + getErrorMessage(err));
          reportError(err, 'useDashboardData.handleSearchEntitiesChange');
        });
    },
    [dashboardConfig],
  );

  const handleQuickActionsChange = useCallback(
    (actions: QuickActionItem[]) => {
      setQuickActions(actions);
      const updatedConfig = { ...dashboardConfig, quickActions: actions };
      setDashboardConfig(updatedConfig);
      userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig })
        .then(() => {
          toast.success('Quick actions updated');
        })
        .catch((err: unknown) => {
          toast.error('Failed to save quick actions: ' + getErrorMessage(err));
          reportError(err, 'useDashboardData.handleQuickActionsChange');
        });
    },
    [dashboardConfig],
  );

  const handlePreferencesChange = useCallback(
    (events: EventType[]) => {
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
    },
    [dashboardConfig],
  );

  const handlePinnedReportsChange = useCallback(
    (newPinnedReports: PinnedReportItem[]) => {
      const updatedConfig = {
        ...dashboardConfig,
        pinnedReports: newPinnedReports,
      };
      setDashboardConfig(updatedConfig);
      userSettingsControllerUpdateSettings({ dashboardConfig: updatedConfig })
        .then(() => {
          toast.success('Pinned reports updated');
        })
        .catch((err: unknown) => {
          toast.error('Failed to save pinned reports: ' + getErrorMessage(err));
          reportError(err, 'useDashboardData.handlePinnedReportsChange');
        });
    },
    [dashboardConfig],
  );

  return {
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
  };
}
