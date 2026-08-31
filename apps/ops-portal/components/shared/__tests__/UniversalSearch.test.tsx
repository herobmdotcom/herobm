import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UniversalSearch from '../UniversalSearch';
import * as api from '@herobm/sdk';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@herobm/sdk', () => ({
  dashboardControllerSearch: jest.fn(),
}));

describe('UniversalSearch', () => {
  const mockSearch = api.dashboardControllerSearch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    render(<UniversalSearch />);
    expect(screen.getByPlaceholderText('placeholder')).toBeInTheDocument();
  });

  it('does not search when query is less than 2 characters', async () => {
    render(<UniversalSearch />);
    const input = screen.getByPlaceholderText('placeholder');

    fireEvent.change(input, { target: { value: 'a' } });

    await waitFor(() => {
      expect(screen.getByText('typeMinChars')).toBeInTheDocument();
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('performs debounced search and displays results grouped by type', async () => {
    mockSearch.mockResolvedValue({
      data: {
        results: [
          {
            id: 'p-1',
            type: 'product',
            label: 'Industrial Pump',
            subtitle: 'PUMP-001',
            href: '/products/p-1',
          },
          {
            id: 'c-1',
            type: 'customer',
            label: 'Acme Heavy Industries',
            subtitle: 'ACME-01',
            href: '/customers/c-1',
          },
        ],
      },
    });

    render(
      <UniversalSearch enabledEntities={['product', 'customer']} />,
    );
    const input = screen.getByPlaceholderText('placeholder');

    fireEvent.change(input, { target: { value: 'pump' } });

    await waitFor(
      () => {
        expect(mockSearch).toHaveBeenCalledWith({
          q: 'pump',
          types: 'product,customer',
        });
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByText('Industrial Pump')).toBeInTheDocument();
      expect(screen.getByText('PUMP-001')).toBeInTheDocument();
      expect(screen.getByText('Acme Heavy Industries')).toBeInTheDocument();
    });
  });

  it('navigates to entity link when clicked', async () => {
    mockSearch.mockResolvedValue({
      data: {
        results: [
          {
            id: 'so-1',
            type: 'sales_order',
            label: 'SO-1001',
            subtitle: 'Main Order',
            href: '/sales-orders/so-1',
          },
        ],
      },
    });

    render(<UniversalSearch />);
    const input = screen.getByPlaceholderText('placeholder');

    fireEvent.change(input, { target: { value: 'SO-1001' } });

    await waitFor(() => {
      expect(screen.getByText('SO-1001')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText('SO-1001'));

    expect(mockPush).toHaveBeenCalledWith('/sales-orders/so-1');
  });

  it('calls onOpenSettings when settings button is clicked', () => {
    const handleOpenSettings = jest.fn();
    render(<UniversalSearch onOpenSettings={handleOpenSettings} />);

    const settingsButton = screen.getByTitle('settings');
    fireEvent.click(settingsButton);

    expect(handleOpenSettings).toHaveBeenCalledTimes(1);
  });
});
