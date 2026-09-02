import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { SystemResource } from '@herobm/shared';

const mockUseAuth = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('@/lib/api', () => ({
  logout: jest.fn(),
}));

jest.mock('../AuthGate', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      'groups.finance': 'Finance',
      'items.fiscalPeriods': 'Fiscal Periods',
      'items.generalLedger': 'General Ledger',
      'items.trialBalance': 'Trial Balance',
      'items.journalEntries': 'Journal Entries',
      'items.dashboard': 'Dashboard',
    };
    return map[key] || key;
  },
}));

describe('App Sidebar Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Fiscal Periods link in Finance section when user has FISCAL_PERIODS read permission', () => {
    mockUseAuth.mockReturnValue({
      authenticated: true,
      role: 'finance',
      permissions: [
        { resource: SystemResource.FISCAL_PERIODS, action: 'read', effect: 'allow' },
        { resource: SystemResource.GL, action: 'read', effect: 'allow' },
      ],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText('Finance'));
    expect(screen.getByText('Fiscal Periods')).toBeInTheDocument();
  });

  it('hides Fiscal Periods link when user lacks FISCAL_PERIODS read permission', () => {
    mockUseAuth.mockReturnValue({
      authenticated: true,
      role: 'viewer',
      permissions: [
        { resource: SystemResource.GL, action: 'read', effect: 'allow' },
      ],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText('Finance'));
    expect(screen.queryByText('Fiscal Periods')).not.toBeInTheDocument();
  });
});
