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

  it('displays error in slide-over when invalid 2FA code is entered and clears on change', async () => {
    const toast = (await import('react-hot-toast')).default;
    const api = await import('@herobm/sdk');
    (api.authControllerEnable2Fa as jest.Mock).mockRejectedValueOnce(new Error('Invalid code'));

    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    // Toggle 2FA switch
    await waitFor(() => {
      expect(document.querySelector('label.switch input')).toBeInTheDocument();
    });
    fireEvent.click(document.querySelector('label.switch input')!);

    // Step 1: Click Next
    await waitFor(() => {
      expect(screen.getByText('setupStep1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 2: Enter code
    await waitFor(() => {
      expect(screen.getByText('setupStep2')).toBeInTheDocument();
    });

    const codeInput = screen.getByPlaceholderText('123456');
    fireEvent.change(codeInput, { target: { value: '000000' } });

    const enableButton = screen.getByText('enable');
    fireEvent.click(enableButton);

    // Verify error is shown inside slide-over and not as a toast
    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalledWith('Invalid code');
    });

    // Modifying code clears the error
    fireEvent.change(codeInput, { target: { value: '123456' } });
    expect(screen.queryByText('Invalid code')).toBeNull();
  });

  it('proceeds to step 3 when valid 2FA code is verified', async () => {
    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(document.querySelector('label.switch input')).toBeInTheDocument();
    });
    fireEvent.click(document.querySelector('label.switch input')!);

    await waitFor(() => {
      expect(screen.getByText('setupStep1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('setupStep2')).toBeInTheDocument();
    });

    const codeInput = screen.getByPlaceholderText('123456');
    fireEvent.change(codeInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByText('enable'));

    await waitFor(() => {
      expect(screen.getByText('setupStep3')).toBeInTheDocument();
      expect(screen.getByText('c1')).toBeInTheDocument();
    });
  });

  it('handles in-line backup code regeneration with error handling and code display', async () => {
    const api = await import('@herobm/sdk');
    (api.authControllerGet2FaStatus as jest.Mock).mockResolvedValueOnce({ data: { enabled: true } });

    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    // Shows 2FA enabled and Regenerate Backup Codes button
    await waitFor(() => {
      expect(screen.getByText('regenerateBackupCodes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('regenerateBackupCodes'));

    // In-line regenerate form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('••••••••');
    const codeInput = screen.getByPlaceholderText('123456');

    // Test error case
    (api.authControllerRegenerateBackupCodes as jest.Mock).mockRejectedValueOnce(new Error('Invalid password'));
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } });
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'regenerate' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });

    // Test success case
    fireEvent.change(passwordInput, { target: { value: 'correct-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'regenerate' }));

    await waitFor(() => {
      expect(screen.getByText('setupStep3')).toBeInTheDocument();
      expect(screen.getByText('c3')).toBeInTheDocument();
      expect(screen.getByText('c4')).toBeInTheDocument();
    });
  });

  it('handles in-line 2FA disable flow with password and OTP', async () => {
    const api = await import('@herobm/sdk');
    (api.authControllerGet2FaStatus as jest.Mock).mockResolvedValueOnce({ data: { enabled: true } });

    render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      const switchInput = document.querySelector('label.switch input') as HTMLInputElement;
      expect(switchInput).toBeInTheDocument();
      expect(switchInput.checked).toBe(true);
    });

    // Toggle switch off
    fireEvent.click(document.querySelector('label.switch input')!);

    // In-line disable form should appear
    await waitFor(() => {
      expect(screen.getByText('disableConfirm')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('••••••••');
    const codeInput = screen.getByPlaceholderText('123456');

    // Test error
    (api.authControllerDisable2Fa as jest.Mock).mockRejectedValueOnce(new Error('Invalid 2FA code'));
    fireEvent.change(passwordInput, { target: { value: 'secret' } }); // TEST_CREDENTIAL
    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'disable' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid 2FA code')).toBeInTheDocument();
    });

    // Test success
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'disable' }));

    await waitFor(() => {
      expect(api.authControllerDisable2Fa).toHaveBeenCalledWith({ password: 'secret', code: '123456' }); // TEST_CREDENTIAL
    });
  });
});



