import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import UsersPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string) => `${ns}.${key}`;
    fn.has = () => true;
    return fn;
  },
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  usersControllerFindAll: jest.fn(),
  rolesControllerFindAll: jest.fn(),
  usersControllerReset2Fa: jest.fn(),
  usersControllerGetEvents: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('UsersPage - 2FA Button state', () => {
  const mockUsers = [
    {
      userId: 'user-1',
      username: 'alice',
      displayName: 'Alice User',
      email: 'alice@example.com',
      role: 'viewer',
      isActive: true,
      twoFactorEnabled: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      userId: 'user-2',
      username: 'bob',
      displayName: 'Bob Admin',
      email: 'bob@example.com',
      role: 'admin',
      isActive: true,
      twoFactorEnabled: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({ data: mockUsers });
    (api.rolesControllerFindAll as jest.Mock).mockResolvedValue({
      data: [{ role: 'admin' }, { role: 'viewer' }],
    });
  });

  it('disables 2FA reset button when 2FA is not enabled, and enables when 2FA is enabled', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button', { name: '2FA' });
    expect(buttons).toHaveLength(2);

    // First button (Alice: twoFactorEnabled = false) should be disabled
    expect(buttons[0]).toBeDisabled();

    // Second button (Bob: twoFactorEnabled = true) should be enabled
    expect(buttons[1]).toBeEnabled();
  });

  it('triggers reset2Fa when clicking enabled 2FA button and user confirms', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (api.usersControllerReset2Fa as jest.Mock).mockResolvedValue({ data: { reset: true } });

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button', { name: '2FA' });
    const bob2FaButton = buttons[1];

    fireEvent.click(bob2FaButton);

    expect(confirmSpy).toHaveBeenCalledWith('admin.users.twoFactor.confirmReset');
    expect(api.usersControllerReset2Fa).toHaveBeenCalledWith('user-2', {});

    confirmSpy.mockRestore();
  });

  it('loads and renders timeline events from usersControllerGetEvents (ADV-191)', async () => {
    const mockEvents = [
      {
        eventId: 'evt-1',
        eventType: 'deleted',
        entityDisplayName: 'charlie',
        actor: 'admin',
        createdOn: '2026-09-08T09:00:00Z',
        payload: { username: 'charlie', role: 'viewer' },
      },
      {
        eventId: 'evt-2',
        eventType: 'created',
        entityDisplayName: 'alice',
        actor: 'admin',
        createdOn: '2026-09-08T08:00:00Z',
        payload: { username: 'alice', role: 'viewer' },
      },
    ];

    (api.usersControllerGetEvents as jest.Mock).mockResolvedValue({ data: mockEvents });

    render(<UsersPage />);

    await waitFor(() => {
      expect(api.usersControllerGetEvents).toHaveBeenCalled();
      expect(screen.getByText('(charlie)')).toBeInTheDocument();
      expect(screen.getByText('(alice)')).toBeInTheDocument();
    });
  });
});
