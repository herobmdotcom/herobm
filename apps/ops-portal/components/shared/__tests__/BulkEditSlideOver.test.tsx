import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BulkEditSlideOver, { type BulkEditFieldDef } from '../BulkEditSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'title') return `Bulk Edit ${values?.count} ${values?.entity}`;
    if (key === 'confirmTitle') return 'Confirm Bulk Update';
    if (key === 'reviewChanges') return `Review Changes (${values?.count})`;
    if (key === 'confirmApply') return `Confirm & Apply to ${values?.count} ${values?.entity}`;
    if (key === 'warningBanner') return `You are about to modify ${values?.count} ${values?.entity}`;
    if (key === 'changesSummary') return `Changes to be applied (${values?.count})`;
    if (key === 'noChange') return 'No Change';
    if (key === 'setValue') return 'Set Value';
    if (key === 'clearInherit') return 'Clear / Inherit';
    if (key === 'backToEdit') return 'Back to Edit';
    if (key === 'success') return `Successfully updated ${values?.updated} ${values?.entity}`;
    return key;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFields: BulkEditFieldDef[] = [
  {
    key: 'customerGroupId',
    label: 'Customer Group',
    type: 'select',
    nullable: true,
    options: [
      { label: 'Retail', value: 'group-1' },
      { label: 'Wholesale', value: 'group-2' },
    ],
  },
  {
    key: 'priceTier',
    label: 'Price Tier',
    type: 'text',
    nullable: true,
  },
  {
    key: 'isOnCreditHold',
    label: 'Credit Hold',
    type: 'boolean',
    nullable: false,
  },
];

describe('BulkEditSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnApply = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <BulkEditSlideOver
        isOpen={false}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={5}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );
    expect(screen.queryByText('Bulk Edit 5 Customers')).not.toBeInTheDocument();
  });

  it('renders field list and default "No Change" modes when open', () => {
    render(
      <BulkEditSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={12}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );

    expect(screen.getByText('Bulk Edit 12 Customers')).toBeInTheDocument();
    expect(screen.getByText('Customer Group')).toBeInTheDocument();
    expect(screen.getByText('Price Tier')).toBeInTheDocument();
    expect(screen.getByText('Credit Hold')).toBeInTheDocument();

    // Review Changes button should initially be disabled because 0 fields changed
    const reviewBtn = screen.getByRole('button', { name: 'Review Changes (0)' });
    expect(reviewBtn).toBeDisabled();
  });

  it('transitions to confirmation step when a field is changed and review is clicked', async () => {
    render(
      <BulkEditSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={8}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );

    // Set Customer Group to 'Wholesale'
    const setValueButtons = screen.getAllByRole('button', { name: 'Set Value' });
    fireEvent.click(setValueButtons[0]); // Customer Group

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'group-2' } });

    // Review button should now be enabled with count 1
    const reviewBtn = screen.getByRole('button', { name: 'Review Changes (1)' });
    expect(reviewBtn).not.toBeDisabled();
    fireEvent.click(reviewBtn);

    // Should now be on confirmation screen
    expect(screen.getByText('Confirm Bulk Update')).toBeInTheDocument();
    expect(screen.getByText('You are about to modify 8 Customers')).toBeInTheDocument();
    expect(screen.getByText('Changes to be applied (1)')).toBeInTheDocument();
    expect(screen.getByText('Wholesale')).toBeInTheDocument();
  });

  it('handles "Clear / Inherit" mode for nullable fields', async () => {
    render(
      <BulkEditSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={4}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );

    // Click "Clear / Inherit" on Price Tier
    const clearButtons = screen.getAllByRole('button', { name: 'Clear / Inherit' });
    fireEvent.click(clearButtons[1]); // Price Tier

    const reviewBtn = screen.getByRole('button', { name: 'Review Changes (1)' });
    fireEvent.click(reviewBtn);

    expect(screen.getByText('Confirm Bulk Update')).toBeInTheDocument();
    expect(screen.getByText('Clear / Inherit')).toBeInTheDocument();
  });

  it('allows returning back to edit mode from confirm screen', () => {
    render(
      <BulkEditSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={3}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );

    const setValueButtons = screen.getAllByRole('button', { name: 'Set Value' });
    fireEvent.click(setValueButtons[2]); // Credit Hold boolean

    fireEvent.click(screen.getByRole('button', { name: 'Review Changes (1)' }));
    expect(screen.getByText('Confirm Bulk Update')).toBeInTheDocument();

    // Click Back to Edit
    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
    expect(screen.getByText('Bulk Edit 3 Customers')).toBeInTheDocument();
  });

  it('submits payload and closes when confirm & apply is clicked', async () => {
    mockOnApply.mockResolvedValueOnce({ updatedCount: 5, skippedCount: 1 });

    render(
      <BulkEditSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entityName="Customers"
        selectedCount={6}
        fields={mockFields}
        onApply={mockOnApply}
      />
    );

    // Set Customer Group to 'Retail'
    const setValueButtons = screen.getAllByRole('button', { name: 'Set Value' });
    fireEvent.click(setValueButtons[0]);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'group-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Review Changes (1)' }));

    const confirmBtn = screen.getByRole('button', { name: 'Confirm & Apply to 6 Customers' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockOnApply).toHaveBeenCalledWith({
        customerGroupId: 'group-1',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
