import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineSettingsSlideOver, {
  DEFAULT_ENABLED_EVENTS,
  ALL_AVAILABLE_EVENTS,
} from '../TimelineSettingsSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('TimelineSettingsSlideOver', () => {
  it('renders all domain categories and controls when open', () => {
    const handleChange = jest.fn();
    render(
      <TimelineSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEvents={DEFAULT_ENABLED_EVENTS}
        onChange={handleChange}
      />,
    );

    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByText('configureInfo')).toBeInTheDocument();
    expect(screen.getByText('selectAll')).toBeInTheDocument();
    expect(screen.getByText('deselectAll')).toBeInTheDocument();
    expect(screen.getByText('resetToDefault')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
  });

  it('toggles an event on and off', () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <TimelineSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEvents={['sales_order.created']}
        onChange={handleChange}
      />,
    );

    // Toggle customer.created on
    const customerCreatedLabel = screen.getByText('types.customer.created');
    fireEvent.click(customerCreatedLabel);

    expect(handleChange).toHaveBeenCalledWith(['sales_order.created', 'customer.created']);

    // Re-render with customer.created enabled, then toggle off
    rerender(
      <TimelineSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEvents={['sales_order.created', 'customer.created']}
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByText('types.customer.created'));
    expect(handleChange).toHaveBeenCalledWith(['sales_order.created']);
  });

  it('handles Select All, Deselect All, and Reset to Defaults', () => {
    const handleChange = jest.fn();
    render(
      <TimelineSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEvents={['sales_order.created']}
        onChange={handleChange}
      />,
    );

    // Select All
    fireEvent.click(screen.getByText('selectAll'));
    expect(handleChange).toHaveBeenCalledWith(ALL_AVAILABLE_EVENTS);

    // Deselect All
    fireEvent.click(screen.getByText('deselectAll'));
    expect(handleChange).toHaveBeenCalledWith([]);

    // Reset to Defaults
    fireEvent.click(screen.getByText('resetToDefault'));
    expect(handleChange).toHaveBeenCalledWith(DEFAULT_ENABLED_EVENTS);
  });
});
