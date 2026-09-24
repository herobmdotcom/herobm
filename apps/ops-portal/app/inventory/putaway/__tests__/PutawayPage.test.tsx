import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PutawayPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (ns?: string) =>
    Object.assign(
      (key: string, params?: Record<string, unknown>) => {
        if (ns === 'inventory') {
          if (key === 'putaway.title') return 'Putaway';
          if (key === 'putaway.action') return 'Putaway Action';
          if (key === 'putaway.pendingPutaway') return 'Pending Putaway';
          if (key === 'putaway.selectItemToPutaway') return 'Select an item from the list to putaway.';
          if (key === 'putaway.loadingBinContext') return 'Loading bin context...';
          if (key === 'putaway.projectStaging') return 'Project Staging:';
          if (key === 'putaway.projectReturn') return 'Project Return:';
          if (key === 'putaway.stagingBin') return 'Staging Bin:';
          if (key === 'putaway.confirmPutaway') return 'Confirm Putaway';
          if (key === 'putaway.searchBins') return 'Search bins...';
          if (key === 'putaway.ref') return `Ref: ${params?.ref}`;
          if (key === 'putaway.currentStock') return `Current stock: ${params?.count}`;
        }
        if (ns === 'common') {
          if (key === 'location') return 'Location';
          if (key === 'loading') return 'Loading...';
        }
        return key;
      },
      { has: () => true }
    ),
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    app: { defaultFulfillmentLocationId: 'loc-1' },
  }),
}));

const mockSetPersistedSetting = jest.fn();
jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: (key: string, defaultVal: string) => {
    if (key === 'putaway-location') return ['loc-1', mockSetPersistedSetting, true];
    return [defaultVal, mockSetPersistedSetting, true];
  },
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

jest.mock('@herobm/sdk', () => ({
  inventoryControllerFindAllLocations: jest.fn(),
  inventoryControllerGetPendingPutaway: jest.fn(),
  inventoryControllerGetPutawayContext: jest.fn(),
  inventoryControllerPutaway: jest.fn(),
}));

describe('PutawayPage - Project Staging Bin Display', () => {
  const mockLocations = [
    { locationId: 'loc-1', code: 'MAIN', name: 'Main Warehouse' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: mockLocations,
    });
  });

  it('renders project staging bin in details above bin selection for project transfer order', async () => {
    (api.inventoryControllerGetPendingPutaway as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'putaway-line-1',
          sourceType: 'transfer_receipt',
          referenceNumber: 'TRF-REC-001',
          productId: 'prod-1',
          productName: 'Solar Inverter 5kW',
          productNumber: 'INV-5000',
          quantity: '5',
          createdOn: '2026-09-20T10:00:00Z',
          projectId: 'proj-1',
          projectNumber: 'FRE-PROJ-001',
          projectName: 'FF Expansion Ph 1',
          projectStagingBinId: 'bin-stg-1',
          projectStagingBinNumber: 'L2.13.3',
          isProjectReturn: false,
        },
      ],
    });

    (api.inventoryControllerGetPutawayContext as jest.Mock).mockResolvedValue({
      data: {
        primaryBinId: 'bin-stg-1',
        primaryBinNumber: 'L2.13.3',
        currentQuantity: 10,
        availableBins: [
          { binId: 'bin-stg-1', binNumber: 'L2.13.3', binType: 'storage', zoneCode: 'MAIN' },
        ],
      },
    });

    render(<PutawayPage />);

    // Wait for the pending putaway line to load
    await waitFor(() => {
      expect(screen.getByText('Solar Inverter 5kW')).toBeInTheDocument();
    });

    // Click the item to open details
    fireEvent.click(screen.getByText('Solar Inverter 5kW'));

    // Verify the project banner is rendered
    await waitFor(() => {
      expect(screen.getByText(/Project Staging:/)).toBeInTheDocument();
      expect(screen.getByText(/FRE-PROJ-001 — FF Expansion Ph 1/)).toBeInTheDocument();
    });

    // Verify the project staging bin is rendered in normal font in details
    expect(screen.getByText('Staging Bin:')).toBeInTheDocument();
    expect(screen.getByText('Staging Bin:').parentElement).toHaveTextContent('L2.13.3');
  });

  it('renders project staging bin for project return transfer orders', async () => {
    (api.inventoryControllerGetPendingPutaway as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'putaway-line-2',
          sourceType: 'transfer_receipt',
          referenceNumber: 'TRF-REC-002',
          productId: 'prod-2',
          productName: 'Heavy Cable 100m',
          productNumber: 'CAB-100',
          quantity: '2',
          createdOn: '2026-09-20T11:00:00Z',
          projectId: 'proj-1',
          projectNumber: 'FRE-PROJ-001',
          projectName: 'FF Expansion Ph 1',
          projectStagingBinId: 'bin-stg-1',
          projectStagingBinNumber: 'L2.13.3',
          isProjectReturn: true,
        },
      ],
    });

    (api.inventoryControllerGetPutawayContext as jest.Mock).mockResolvedValue({
      data: {
        primaryBinId: 'bin-wh-1',
        primaryBinNumber: 'W1.01.1',
        currentQuantity: 5,
        availableBins: [
          { binId: 'bin-wh-1', binNumber: 'W1.01.1', binType: 'storage', zoneCode: 'MAIN' },
        ],
      },
    });

    render(<PutawayPage />);

    await waitFor(() => {
      expect(screen.getByText('Heavy Cable 100m')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Heavy Cable 100m'));

    await waitFor(() => {
      expect(screen.getByText(/Project Return:/)).toBeInTheDocument();
      expect(screen.getByText(/FRE-PROJ-001 — FF Expansion Ph 1/)).toBeInTheDocument();
    });

    expect(screen.getByText('Staging Bin:')).toBeInTheDocument();
    expect(screen.getByText('Staging Bin:').parentElement).toHaveTextContent('L2.13.3');
  });

  it('does not render staging bin when putaway item does not relate to a project', async () => {
    (api.inventoryControllerGetPendingPutaway as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'putaway-line-3',
          sourceType: 'goods_receipt',
          referenceNumber: 'GRN-001',
          productId: 'prod-3',
          productName: 'Standard Bracket',
          productNumber: 'BRK-001',
          quantity: '20',
          createdOn: '2026-09-20T12:00:00Z',
          projectId: null,
          projectNumber: null,
          projectName: null,
          projectStagingBinId: null,
          projectStagingBinNumber: null,
          isProjectReturn: null,
        },
      ],
    });

    (api.inventoryControllerGetPutawayContext as jest.Mock).mockResolvedValue({
      data: {
        primaryBinId: 'bin-wh-2',
        primaryBinNumber: 'W1.02.1',
        currentQuantity: 10,
        availableBins: [
          { binId: 'bin-wh-2', binNumber: 'W1.02.1', binType: 'storage', zoneCode: 'MAIN' },
        ],
      },
    });

    render(<PutawayPage />);

    await waitFor(() => {
      expect(screen.getByText('Standard Bracket')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Standard Bracket'));

    await waitFor(() => {
      expect(screen.queryByText(/Project Staging:/)).not.toBeInTheDocument();
      expect(screen.queryByText('Staging Bin:')).not.toBeInTheDocument();
    });
  });
});

describe('PutawayPage - Location Persistence', () => {
  const mockLocations = [
    { locationId: 'loc-1', code: 'MAIN', name: 'Main Warehouse' },
    { locationId: 'loc-2', code: 'SEC', name: 'Secondary Warehouse' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: mockLocations,
    });
    (api.inventoryControllerGetPendingPutaway as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('initializes with the persisted location and updates persisted setting when changed', async () => {
    render(<PutawayPage />);

    await waitFor(() => {
      expect(api.inventoryControllerGetPendingPutaway).toHaveBeenCalledWith({ locationId: 'loc-1' });
    });

    const locationSelect = screen.getByRole('combobox');
    expect(locationSelect).toHaveValue('loc-1');

    fireEvent.change(locationSelect, { target: { value: 'loc-2' } });

    expect(mockSetPersistedSetting).toHaveBeenCalledWith('loc-2');
  });
});

