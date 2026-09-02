'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import type { DisplayDensity, ThemeMode, UserPreferences } from '@herobm/shared';

const PREFS_STORAGE_KEY = 'herobm_user_prefs';

function isSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { density: 'comfortable', theme: 'system' };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          density: parsed.density === 'compact' ? 'compact' : 'comfortable',
          theme: parsed.theme === 'dark' ? 'dark' : parsed.theme === 'light' ? 'light' : 'system',
          ...parsed,
        };
      }
    }
  } catch {
    // ignore JSON parsing/storage access error
  }
  return { density: 'comfortable', theme: 'system' };
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

function applyThemeToDom(theme: ThemeMode): boolean {
  if (typeof document !== 'undefined') {
    const isDark = theme === 'dark' || (theme === 'system' && isSystemDark());
    const docEl = document.documentElement;
    docEl.classList.toggle('dark', isDark);
    docEl.classList.toggle('herobm-dark', isDark);
    docEl.classList.toggle('herobm-light', !isDark);
    docEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
    docEl.style.colorScheme = isDark ? 'dark' : 'light';

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#101726' : '#006b5c');
    }
    return isDark;
  }
  return false;
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
  theme: ThemeMode;
  isDarkMode: boolean;
  isLoading: boolean;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateDashboardConfig: (config: Record<string, unknown>) => Promise<void>;
  updateReportConfigs: (configs: Record<string, unknown>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: null,
  preferences: { density: 'comfortable', theme: 'system' },
  density: 'comfortable',
  theme: 'system',
  isDarkMode: false,
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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const currentTheme = preferences.theme || 'system';
    return currentTheme === 'dark' || (currentTheme === 'system' && isSystemDark());
  });
  const [isLoading, setIsLoading] = useState(true);

  // Apply locale, density, and theme on initial render and state changes
  useEffect(() => {
    applyLocaleToDom();
    applyDensityToDom(preferences.density || 'comfortable');
    const dark = applyThemeToDom(preferences.theme || 'system');
    setIsDarkMode(dark);
  }, [preferences.density, preferences.theme]);

  // Listen to OS scheme changes if theme === 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((preferences.theme || 'system') === 'system') {
        const dark = applyThemeToDom('system');
        setIsDarkMode(dark);
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preferences.theme]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.userSettingsControllerGetSettings();
      if (res?.data) {
        setSettings(res.data);
        const serverPrefs: UserPreferences = {
          density: 'comfortable',
          theme: 'system',
          ...((res.data.preferences as UserPreferences) || {}),
        };
        setPreferences(serverPrefs);
        writeStoredPreferences(serverPrefs);
        applyDensityToDom(serverPrefs.density || 'comfortable');
        const dark = applyThemeToDom(serverPrefs.theme || 'system');
        setIsDarkMode(dark);
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
      if (partial.theme) {
        const dark = applyThemeToDom(partial.theme);
        setIsDarkMode(dark);
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

  const theme = useMemo<ThemeMode>(() => {
    return preferences.theme === 'dark' ? 'dark' : preferences.theme === 'light' ? 'light' : 'system';
  }, [preferences.theme]);

  const contextValue = useMemo<UserSettingsContextType>(() => ({
    settings,
    preferences,
    density,
    theme,
    isDarkMode,
    isLoading,
    updatePreferences,
    updateDashboardConfig,
    updateReportConfigs,
    refreshSettings: loadSettings,
  }), [settings, preferences, density, theme, isDarkMode, isLoading, updatePreferences, updateDashboardConfig, updateReportConfigs, loadSettings]);

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  );
}

