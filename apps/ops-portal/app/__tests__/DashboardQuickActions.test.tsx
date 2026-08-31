import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardQuickActions from '../DashboardQuickActions';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DashboardQuickActions', () => {
  it('renders default quick actions when none are explicitly passed', () => {
    render(<DashboardQuickActions />);

    expect(screen.getByText('quickActions.title')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createQuote')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createSalesOrder')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createPurchaseOrder')).toBeInTheDocument();
  });

  it('renders custom quick actions and filtered preset actions', () => {
    const customActions = [
      {
        id: 'create_product',
        title: 'createProduct',
        description: 'createProductDesc',
        href: '/products/new',
        icon: 'category',
        enabled: true,
      },
      {
        id: 'custom_1',
        title: 'Customer Balances',
        description: 'View customer accounts',
        href: '/balances/customers',
        icon: 'payments',
        enabled: true,
        isCustom: true,
      },
      {
        id: 'custom_external',
        title: 'External Documentation',
        description: 'Open external docs',
        href: 'https://docs.herobm.com',
        icon: 'menu_book',
        enabled: true,
        isCustom: true,
      },
    ];

    render(<DashboardQuickActions quickActions={customActions} />);

    expect(screen.getByText('quickActions.createProduct')).toBeInTheDocument();
    expect(screen.getByText('Customer Balances')).toBeInTheDocument();
    expect(screen.getByText('View customer accounts')).toBeInTheDocument();
    expect(screen.getByText('External Documentation')).toBeInTheDocument();

    // Check external link rendering
    const externalLink = screen.getByRole('link', { name: /External Documentation/i });
    expect(externalLink).toHaveAttribute('href', 'https://docs.herobm.com');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onOpenSettings when settings gear is clicked', () => {
    const handleOpenSettings = jest.fn();
    render(<DashboardQuickActions onOpenSettings={handleOpenSettings} />);

    const settingsButton = screen.getByTitle('quickActions.manage');
    fireEvent.click(settingsButton);

    expect(handleOpenSettings).toHaveBeenCalledTimes(1);
  });
});
