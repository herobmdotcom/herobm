import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateStocktakeSlideOver from '../CreateStocktakeSlideOver';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  stocktakesControllerCreate: jest.fn(),
  inventoryControllerFindAllLocations: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

const mockTranslations: Record<string, string> = {
  title: 'Create Stocktake',
  subtitle: 'Define scope, location, and counting mode for a new physical stocktake',
  nameLabel: 'Stocktake Title *',
  namePlaceholder: 'e.g. Q3 Full Warehouse Stocktake',
  locationLabel: 'Fulfillment Location *',
  scopeLabel: 'Counting Scope *',
  zoneLabel: 'Zone Code Filter',
  zonePlaceholder: 'e.g. ZONE-A',
  binPatternLabel: 'Bin Prefix Pattern',
  binPatternPlaceholder: 'e.g. A-01 or RACK',
  blindCountLabel: 'Blind Count Mode',
  blindCountDesc: 'Hide expected on-hand quantities from operators during active counting',
  notesLabel: 'Notes / Instructions',
  notesPlaceholder: 'Optional counting instructions or team assignments...',
  createButton: 'Create Stocktake',
  creating: 'Creating Stocktake...',
  cancel: 'Cancel',
  selectNone: 'Select Location...',
  loadingEllipsis: 'Loading...',
  full: 'Full Location',
  zone: 'Zone Filter',
  bin_pattern: 'Bin Prefix Pattern',
  manual: 'Manual / Empty',
};

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => mockTranslations[key] || key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CreateStocktakeSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: [
        { locationId: 'loc-1', code: 'C-DC', name: 'Central Retail DC' },
        { locationId: 'loc-2', code: 'W-DC', name: 'West Coast DC' },
      ],
    });
  });

  it('renders standard slide-over without subtitle and with standard footer buttons', async () => {
    render(
      <CreateStocktakeSlideOver
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />,
    );

    // Title heading should exist
    expect(screen.getByRole('heading', { name: 'Create Stocktake' })).toBeInTheDocument();

    // Subtitle should NOT exist
    expect(
      screen.queryByText('Define scope, location, and counting mode for a new physical stocktake'),
    ).not.toBeInTheDocument();

    // Standard input fields should use the .input class
    const titleInput = screen.getByPlaceholderText('e.g. Q3 Full Warehouse Stocktake');
    expect(titleInput).toHaveClass('input');

    const notesTextarea = screen.getByPlaceholderText('Optional counting instructions or team assignments...');
    expect(notesTextarea).toHaveClass('input');

    // Footer buttons exist
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const createBtn = screen.getByRole('button', { name: 'Create Stocktake' });
    expect(cancelBtn).toBeInTheDocument();
    expect(createBtn).toBeInTheDocument();
  });

  it('submits form successfully when required fields are populated', async () => {
    const user = userEvent.setup();
    (api.stocktakesControllerCreate as jest.Mock).mockResolvedValue({
      data: {
        stocktakeId: 'st-123',
        stocktakeNumber: 'STK-0001',
      },
    });

    render(
      <CreateStocktakeSlideOver
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />,
    );

    const titleInput = screen.getByPlaceholderText('e.g. Q3 Full Warehouse Stocktake');
    await user.type(titleInput, 'Zone A - Q3 check');

    // Wait for locations to load
    await waitFor(() => {
      expect(screen.getByText('C-DC — Central Retail DC')).toBeInTheDocument();
    });

    // Select location (first combobox in form)
    const comboboxes = screen.getAllByRole('combobox');
    const locationSelect = comboboxes[0];
    await user.selectOptions(locationSelect, 'loc-1');

    // Submit form via footer button
    const createBtn = screen.getByRole('button', { name: 'Create Stocktake' });
    await user.click(createBtn);

    await waitFor(() => {
      expect(api.stocktakesControllerCreate).toHaveBeenCalledWith({
        name: 'Zone A - Q3 check',
        locationId: 'loc-1',
        scopeType: 'full',
        zoneFilter: undefined,
        binPattern: undefined,
        isBlindCount: false,
        notes: undefined,
      });
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnCreated).toHaveBeenCalledWith('st-123');
    });
  });
});
