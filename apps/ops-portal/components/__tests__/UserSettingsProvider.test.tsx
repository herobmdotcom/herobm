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
  const { density, preferences, updatePreferences, isLoading } = useUserSettings();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="density">{density}</div>
      <div data-testid="preferences">{JSON.stringify(preferences)}</div>
      <button
        onClick={() => updatePreferences({ density: 'compact' })}
        data-testid="btn-compact"
      >
        Set Compact
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
    jest.clearAllMocks();
  });

  it('loads settings and sets density attribute on documentElement', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        preferences: { density: 'compact' },
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
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
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
      preferences: { density: 'compact' },
    });
  });
});
