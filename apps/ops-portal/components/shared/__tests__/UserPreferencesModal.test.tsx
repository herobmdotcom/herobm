import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserPreferencesModal from '../UserPreferencesModal';

const mockUpdatePreferences = jest.fn();

jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    authenticated: true,
    role: 'admin',
    permissions: [],
  }),
}));

jest.mock('@/components/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    preferences: { density: 'comfortable' },
    density: 'comfortable',
    updatePreferences: mockUpdatePreferences,
  }),
}));

jest.mock('@herobm/sdk', () => ({
  authControllerGet2FaStatus: jest.fn().mockResolvedValue({ data: { enabled: false } }),
  authControllerSetup2Fa: jest.fn().mockResolvedValue({ data: { secret: 'SEC', qrCodeDataUrl: 'data:img', backupCodes: ['c1', 'c2'] } }),
  authControllerEnable2Fa: jest.fn().mockResolvedValue({ data: { success: true } }),
  authControllerDisable2Fa: jest.fn().mockResolvedValue({ data: { success: true } }),
  authControllerRegenerateBackupCodes: jest.fn().mockResolvedValue({ data: { backupCodes: ['c3', 'c4'] } }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('UserPreferencesModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <UserPreferencesModal isOpen={false} onClose={mockOnClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly and switches density with auto-save', async () => {
    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();

    const compactRadio = document.querySelector('input[value="compact"]') as HTMLInputElement;
    expect(compactRadio).toBeInTheDocument();
    fireEvent.click(compactRadio);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        density: 'compact',
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it('renders 2FA switch and triggers setup on toggle', async () => {
    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      const switchInput = document.querySelector('label.switch input') as HTMLInputElement;
      expect(switchInput).toBeInTheDocument();
      expect(switchInput.checked).toBe(false);
    });

    const switchInput = document.querySelector('label.switch input') as HTMLInputElement;
    fireEvent.click(switchInput);

    await waitFor(() => {
      expect(screen.getByText('setupStep1')).toBeInTheDocument();
    });
  });
});

