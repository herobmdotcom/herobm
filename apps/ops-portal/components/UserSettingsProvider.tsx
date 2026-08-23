'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import type { DisplayDensity, UserPreferences } from '@herobm/shared';

const PREFS_STORAGE_KEY = 'herobm_user_prefs';

function readStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { density: 'comfortable' };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          density: parsed.density === 'compact' ? 'compact' : 'comfortable',
          ...parsed,
        };
      }
    }
  } catch {
    // ignore JSON parsing/storage access error
  }
  return { density: 'comfortable' };
}

function writeStoredPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota error
  }
}

function applyDensityToDom(density: DisplayDensity): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-density', density);
  }
}

function applyLocaleToDom(): void {
  if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.language) {
    document.documentElement.lang = navigator.language;
  }
}

interface UserSettingsContextType {
  settings: api.UserSettingsResponseDto | null;
  preferences: UserPreferences;
  density: DisplayDensity;
  isLoading: boolean;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateDashboardConfig: (config: Record<string, unknown>) => Promise<void>;
  updateReportConfigs: (configs: Record<string, unknown>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: null,
  preferences: { density: 'comfortable' },
  density: 'comfortable',
  isLoading: true,
  updatePreferences: async () => {},
  updateDashboardConfig: async () => {},
  updateReportConfigs: async () => {},
  refreshSettings: async () => {},
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<api.UserSettingsResponseDto | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(() => readStoredPreferences());
  const [isLoading, setIsLoading] = useState(true);

  // Apply locale and density on initial render immediately
  useEffect(() => {
    applyLocaleToDom();
    applyDensityToDom(preferences.density || 'comfortable');
  }, [preferences.density]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.userSettingsControllerGetSettings();
      if (res?.data) {
        setSettings(res.data);
        const serverPrefs: UserPreferences = {
          density: 'comfortable',
          ...((res.data.preferences as UserPreferences) || {}),
        };
        setPreferences(serverPrefs);
        writeStoredPreferences(serverPrefs);
        applyDensityToDom(serverPrefs.density || 'comfortable');
      }
    } catch (err: unknown) {
      // Don't loudly log 401 unauthenticated errors before login
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API error boundary
      const anyErr = err as any;
      if (anyErr?.message !== 'Not authenticated' && anyErr?.status !== 401 && anyErr?.status !== 403) {
        reportError(err, 'UserSettingsProvider');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const updated: UserPreferences = {
        ...preferences,
        ...partial,
      };

      // Optimistic update
      setPreferences(updated);
      writeStoredPreferences(updated);
      if (partial.density) {
        applyDensityToDom(partial.density);
      }

      try {
        const res = await api.userSettingsControllerUpdateSettings({
          preferences: updated as Record<string, unknown>,
        });
        if (res?.data) {
          setSettings(res.data);
        }
      } catch (err: unknown) {
        // Roll back on error
        reportError(err, 'updatePreferences');
        loadSettings();
        throw err;
      }
    },
    [preferences, loadSettings],
  );

  const updateDashboardConfig = useCallback(
    async (config: Record<string, unknown>) => {
      try {
        const res = await api.userSettingsControllerUpdateSettings({
          dashboardConfig: config,
        });
        if (res?.data) {
          setSettings(res.data);
        }
      } catch (err: unknown) {
        reportError(err, 'updateDashboardConfig');
        throw err;
      }
    },
    [],
  );

  const updateReportConfigs = useCallback(
    async (configs: Record<string, unknown>) => {
      try {
        const res = await api.userSettingsControllerUpdateSettings({
          reportConfigs: configs,
        });
        if (res?.data) {
          setSettings(res.data);
        }
      } catch (err: unknown) {
        reportError(err, 'updateReportConfigs');
        throw err;
      }
    },
    [],
  );

  const density = useMemo<DisplayDensity>(() => {
    return preferences.density === 'compact' ? 'compact' : 'comfortable';
  }, [preferences.density]);

  const contextValue = useMemo<UserSettingsContextType>(() => ({
    settings,
    preferences,
    density,
    isLoading,
    updatePreferences,
    updateDashboardConfig,
    updateReportConfigs,
    refreshSettings: loadSettings,
  }), [settings, preferences, density, isLoading, updatePreferences, updateDashboardConfig, updateReportConfigs, loadSettings]);

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  );
}
