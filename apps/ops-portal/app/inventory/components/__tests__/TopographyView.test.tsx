import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TopographyView from '../TopographyView';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) => {
      if (key === 'pagination.showing' && values) {
        return `Showing ${values.start}–${values.end} of ${values.total}`;
      }
      if (key === 'zonesCount' && values) {
        return `${values.count} zones`;
      }
      if (key === 'binsCount' && values) {
        return `${values.count} bins`;
      }
      if (key === 'addZoneTo' && values) {
        return `Add Zone to ${values.name}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    user: { userId: 'test-user', role: 'admin' },
    permissions: [{ resource: 'inventory', action: 'write', effect: 'allow' }],
  }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@herobm/sdk', () => ({
  inventoryControllerGetTopography: jest.fn(),
  locationsControllerCreateLocation: jest.fn(),
  locationsControllerUpdateLocation: jest.fn(),
  locationsControllerDeleteLocation: jest.fn(),
  locationsControllerCreateZone: jest.fn(),
  locationsControllerUpdateZone: jest.fn(),
  locationsControllerDeleteZone: jest.fn(),
  locationsControllerCreateBin: jest.fn(),
  locationsControllerUpdateBin: jest.fn(),
  locationsControllerDeleteBin: jest.fn(),
}));

const generateMockBins = (count: number, prefix: string) => {
  return Array.from({ length: count }, (_, i) => ({
    binId: `bin-${prefix}-${i + 1}`,
    zoneId: `zone-${prefix}`,
    binNumber: `${prefix}.${i + 1}`,
    binType: 'storage',
    isConsignment: false,
    isBonded: false,
    isUnavailable: false,
    source: 'app',
  }));
};

const mockTopographyData = [
  {
    locationId: 'loc-1',
    code: 'MAIN',
    name: 'Main Warehouse',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Sydney',
    stateOrProvince: 'NSW',
    country: 'Australia',
    postalCode: '2000',
    source: 'app',
    zones: [
      {
        zoneId: 'zone-handling',
        locationId: 'loc-1',
        code: 'HANDLING',
        name: 'Handling System Zone',
        source: 'system',
        bins: [
          {
            binId: 'bin-rec',
            zoneId: 'zone-handling',
            binNumber: 'RECEIVING',
            binType: 'receiving',
            isConsignment: false,
            isBonded: false,
            isUnavailable: false,
            source: 'system',
          },
          {
            binId: 'bin-ship',
            zoneId: 'zone-handling',
            binNumber: 'SHIPPING',
            binType: 'staging',
            isConsignment: false,
            isBonded: false,
            isUnavailable: false,
            source: 'system',
          },
        ],
      },
      {
        zoneId: 'zone-bulk',
        locationId: 'loc-1',
        code: 'BULK',
        name: 'Bulk Storage',
        source: 'app',
        // 120 bins to test pagination (50 per page = 3 pages)
        bins: generateMockBins(120, 'B'),
      },
    ],
  },
];

describe('TopographyView Component (ADV-209)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerGetTopography as jest.Mock).mockResolvedValue({
      data: mockTopographyData,
    });
  });

  it('renders locations, zones, and auto-expands the first location and first zone', async () => {
    render(<TopographyView />);

    await waitFor(() => {
      expect(screen.getByText('MAIN')).toBeInTheDocument();
      expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    });

    // Zone HANDLING and RECEIVING bin are rendered from auto-expansion
    expect(screen.getByText('HANDLING')).toBeInTheDocument();
    expect(screen.getAllByText('RECEIVING').length).toBeGreaterThan(0);
  });

  it('paginates large bin datasets in expanded zones (50 bins per page)', async () => {
    render(<TopographyView />);

    await waitFor(() => {
      expect(screen.getByText('BULK')).toBeInTheDocument();
    });

    // Expand BULK zone
    fireEvent.click(screen.getByText('BULK'));

    // Verify pagination controls appear for 120 bins
    await waitFor(() => {
      expect(screen.getByText('Showing 1–50 of 120')).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    // First page items are present
    expect(screen.getAllByText('B.1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B.50').length).toBeGreaterThan(0);
    expect(screen.queryByText('B.51')).not.toBeInTheDocument();

    // Click Next button
    const nextBtn = screen.getByRole('button', { name: 'pagination.next' });
    fireEvent.click(nextBtn);

    // Page 2 items are now present
    expect(screen.getByText('Showing 51–100 of 120')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getAllByText('B.51').length).toBeGreaterThan(0);
    expect(screen.queryByText('B.1')).not.toBeInTheDocument();
  });

  it('filters bins in zone by search query and resets pagination', async () => {
    render(<TopographyView />);

    await waitFor(() => {
      expect(screen.getByText('BULK')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('BULK'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('placeholders.searchBins')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('placeholders.searchBins');
    fireEvent.change(searchInput, { target: { value: 'B.10' } });

    // Should filter to B.10, B.100, B.101, etc.
    await waitFor(() => {
      expect(screen.getAllByText('B.10').length).toBeGreaterThan(0);
      expect(screen.queryByText('B.2')).not.toBeInTheDocument();
    });
  });

  it('opens and closes Add Zone slide-over modal without crashing', async () => {
    render(<TopographyView />);

    await waitFor(() => {
      expect(screen.getByText('MAIN')).toBeInTheDocument();
    });

    const addZoneBtn = screen.getByTitle('Add Zone to MAIN');
    fireEvent.click(addZoneBtn);

    // Modal title should appear
    expect(screen.getByText('addZone')).toBeInTheDocument();

    // Cancel modal
    const cancelBtn = screen.getByRole('button', { name: 'cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('addZone')).not.toBeInTheDocument();
    });
  });
});
