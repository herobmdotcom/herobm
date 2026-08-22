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

  it('renders correctly and switches density when selected', async () => {
    const { container } = render(<UserPreferencesModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();

    const compactRadio = document.querySelector('input[value="compact"]') as HTMLInputElement;
    expect(compactRadio).toBeInTheDocument();
    fireEvent.click(compactRadio);

    const saveButton = screen.getByText('save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        density: 'compact',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
