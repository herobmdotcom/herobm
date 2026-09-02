import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchSettingsSlideOver, {
  DEFAULT_SEARCH_ENTITIES,
  ALL_SEARCH_ENTITIES,
} from '../SearchSettingsSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('SearchSettingsSlideOver', () => {
  it('renders all domain categories and checkboxes when open', () => {
    const handleChange = jest.fn();
    render(
      <SearchSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEntities={DEFAULT_SEARCH_ENTITIES}
        onChange={handleChange}
      />,
    );

    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByText('selectAll')).toBeInTheDocument();
    expect(screen.getByText('deselectAll')).toBeInTheDocument();
    expect(screen.getByText('resetToDefault')).toBeInTheDocument();
  });

  it('toggles an entity on and off', () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <SearchSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEntities={['product']}
        onChange={handleChange}
      />,
    );

    // Toggle customer on
    const customerLabel = screen.getByText('types.customer');
    fireEvent.click(customerLabel);

    expect(handleChange).toHaveBeenCalledWith(['product', 'customer']);

    // Re-render with customer enabled, then toggle off
    rerender(
      <SearchSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEntities={['product', 'customer']}
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByText('types.customer'));
    expect(handleChange).toHaveBeenCalledWith(['product']);
  });

  it('handles Select All, Deselect All, and Reset to Defaults', () => {
    const handleChange = jest.fn();
    render(
      <SearchSettingsSlideOver
        isOpen={true}
        onClose={jest.fn()}
        enabledEntities={['product']}
        onChange={handleChange}
      />,
    );

    // Select All
    fireEvent.click(screen.getByText('selectAll'));
    expect(handleChange).toHaveBeenCalledWith(ALL_SEARCH_ENTITIES);

    // Deselect All
    fireEvent.click(screen.getByText('deselectAll'));
    expect(handleChange).toHaveBeenCalledWith([]);

    // Reset to Defaults
    fireEvent.click(screen.getByText('resetToDefault'));
    expect(handleChange).toHaveBeenCalledWith(DEFAULT_SEARCH_ENTITIES);
  });
});
