import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UserSettingsProvider, useUserSettings } from '../UserSettingsProvider';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  userSettingsControllerGetSettings: jest.fn(),
  userSettingsControllerUpdateSettings: jest.fn(),
  setSdkConfig: jest.fn(),
}));

function TestConsumer() {
  const { density, theme, isDarkMode, preferences, updatePreferences, isLoading } = useUserSettings();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="density">{density}</div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="isDarkMode">{isDarkMode ? 'true' : 'false'}</div>
      <div data-testid="preferences">{JSON.stringify(preferences)}</div>
      <button
        onClick={() => updatePreferences({ density: 'compact' })}
        data-testid="btn-compact"
      >
        Set Compact
      </button>
      <button
        onClick={() => updatePreferences({ theme: 'dark' })}
        data-testid="btn-dark"
      >
        Set Dark
      </button>
    </div>
  );
}

describe('UserSettingsProvider', () => {
  const mockGetSettings = api.userSettingsControllerGetSettings as jest.Mock;
  const mockUpdateSettings = api.userSettingsControllerUpdateSettings as jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark', 'herobm-dark', 'herobm-light');
    jest.clearAllMocks();
  });

  it('loads settings and sets density and theme attributes on documentElement', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        preferences: { density: 'compact', theme: 'dark' },
        dashboardConfig: {},
        reportConfigs: {},
      },
    });

    render(
      <UserSettingsProvider>
        <TestConsumer />
      </UserSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('density').textContent).toBe('compact');
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('isDarkMode').textContent).toBe('true');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('herobm-dark')).toBe(true);
  });

  it('optimistically updates density and saves to API', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        preferences: { density: 'comfortable' },
      },
    });
    mockUpdateSettings.mockResolvedValue({
      data: {
        preferences: { density: 'compact' },
      },
    });

    render(
      <UserSettingsProvider>
        <TestConsumer />
      </UserSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('density').textContent).toBe('comfortable');

    await act(async () => {
      screen.getByTestId('btn-compact').click();
    });

    expect(screen.getByTestId('density').textContent).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      preferences: { density: 'compact', theme: 'system' },
    });
  });

  it('optimistically updates theme and updates DOM classes', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        preferences: { theme: 'light' },
      },
    });
    mockUpdateSettings.mockResolvedValue({
      data: {
        preferences: { theme: 'dark' },
      },
    });

    render(
      <UserSettingsProvider>
        <TestConsumer />
      </UserSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('isDarkMode').textContent).toBe('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await act(async () => {
      screen.getByTestId('btn-dark').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('isDarkMode').textContent).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      preferences: { density: 'comfortable', theme: 'dark' },
    });
  });
});
