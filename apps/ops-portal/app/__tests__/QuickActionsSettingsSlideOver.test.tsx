import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickActionsSettingsSlideOver, {
  DEFAULT_QUICK_ACTIONS,
} from '../QuickActionsSettingsSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('QuickActionsSettingsSlideOver', () => {
  it('renders presets and handles toggling preset actions', () => {
    const handleChange = jest.fn();
    render(
      <QuickActionsSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        quickActions={DEFAULT_QUICK_ACTIONS}
        onChange={handleChange}
      />,
    );

    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByText('presets')).toBeInTheDocument();

    // Toggle a preset
    const quoteLabel = screen.getByText('createQuote');
    fireEvent.click(quoteLabel);

    expect(handleChange).toHaveBeenCalled();
  });

  it('allows adding a custom quick action with validation and custom icon', () => {
    const handleChange = jest.fn();
    render(
      <QuickActionsSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        quickActions={DEFAULT_QUICK_ACTIONS}
        onChange={handleChange}
      />,
    );

    // Open custom action form
    const addBtn = screen.getByText('addCustomAction');
    fireEvent.click(addBtn);

    expect(screen.getByText('form.save')).toBeInTheDocument();

    // Attempt to submit empty form
    fireEvent.click(screen.getByText('form.save'));
    expect(screen.getByText('form.validation')).toBeInTheDocument();
    expect(handleChange).not.toHaveBeenCalled();

    // Fill in title, full external URL, and custom material icon
    fireEvent.change(screen.getByPlaceholderText('form.titlePlaceholder'), {
      target: { value: 'External BI Dashboard' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        'e.g. /balances/customers or https://analytics.example.com',
      ),
      {
        target: { value: 'https://analytics.example.com' },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText('e.g. shopping_bag, bar_chart, public'),
      {
        target: { value: 'bar_chart' },
      },
    );

    fireEvent.click(screen.getByText('form.save'));

    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'External BI Dashboard',
          href: 'https://analytics.example.com',
          icon: 'bar_chart',
          isCustom: true,
          enabled: true,
        }),
      ]),
    );
  });

  it('allows deleting an existing custom quick action', () => {
    const handleChange = jest.fn();
    const customActions = [
      ...DEFAULT_QUICK_ACTIONS,
      {
        id: 'custom_123',
        title: 'Custom Action',
        href: 'https://example.com',
        icon: 'link',
        enabled: true,
        isCustom: true,
      },
    ];

    render(
      <QuickActionsSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        quickActions={customActions}
        onChange={handleChange}
      />,
    );

    expect(screen.getByText('Custom Action')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('deleteCustomAction');
    fireEvent.click(deleteBtn);

    expect(handleChange).toHaveBeenCalledWith(DEFAULT_QUICK_ACTIONS);
  });
});
