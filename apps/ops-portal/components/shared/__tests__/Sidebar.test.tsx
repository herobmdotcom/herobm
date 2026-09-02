import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { logout } from '../../../lib/api';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('../../../lib/api', () => ({
  logout: jest.fn(),
}));

jest.mock('../AuthGate', () => ({
  useAuth: () => ({
    authenticated: true,
    role: 'admin',
    username: 'john.doe',
    displayName: 'John Doe',
    permissions: [],
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      settings: 'Settings',
      signOut: 'Sign Out',
      title: 'User Preferences',
    };
    return map[key] || key;
  },
}));

jest.mock('../UserPreferencesModal', () => {
  return function MockUserPreferencesModal({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) {
    return isOpen ? (
      <div data-testid="user-preferences-modal">
        <button onClick={onClose}>Close Preferences</button>
      </div>
    ) : null;
  };
});

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user button with initial and help button', () => {
    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={[]}
      />,
    );

    // Initial 'J' and help '?' button
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('toggles the menu when user button is clicked', () => {
    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={[]}
      />,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const userButton = screen.getByText('J').closest('button');
    expect(userButton).toBeInTheDocument();
    fireEvent.click(userButton!);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText('Settings')).toBeInTheDocument();
    expect(within(menu).getByText('Sign Out')).toBeInTheDocument();

    // Clicking again closes menu
    fireEvent.click(userButton!);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens UserPreferencesModal when Settings is clicked', () => {
    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={[]}
      />,
    );

    const userButton = screen.getByText('J').closest('button');
    fireEvent.click(userButton!);

    const settingsItem = screen.getByText('Settings');
    fireEvent.click(settingsItem);

    // Menu should close and preferences modal should open
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-preferences-modal')).toBeInTheDocument();
  });

  it('calls logout when Sign Out is clicked', () => {
    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={[]}
      />,
    );

    const userButton = screen.getByText('J').closest('button');
    fireEvent.click(userButton!);

    const signOutItem = screen.getByText('Sign Out');
    fireEvent.click(signOutItem);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the menu on Escape key press', () => {
    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={[]}
      />,
    );

    const userButton = screen.getByText('J').closest('button');
    fireEvent.click(userButton!);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders sections and expands items when clicking section headers', () => {
    const testSections = [
      {
        label: 'Sales',
        items: [
          { href: '/sales-orders', label: 'Sales Orders', icon: 'receipt_long' },
        ],
      },
      {
        label: 'Finance',
        items: [
          { href: '/general-ledger', label: 'General Ledger', icon: 'menu_book' },
        ],
      },
    ];

    render(
      <Sidebar
        title="HeroBM"
        subtitle="Business Management"
        sections={testSections}
      />,
    );

    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();

    // Clicking 'Sales' section header toggles its items
    const salesHeader = screen.getByText('Sales');
    fireEvent.click(salesHeader);
    expect(screen.getByText('Sales Orders')).toBeInTheDocument();

    // Clicking 'Finance' section header expands Finance items independently
    const financeHeader = screen.getByText('Finance');
    fireEvent.click(financeHeader);
    expect(screen.getByText('General Ledger')).toBeInTheDocument();
  });
});
