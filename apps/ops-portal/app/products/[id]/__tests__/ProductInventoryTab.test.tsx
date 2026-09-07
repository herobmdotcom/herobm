import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductInventoryTab } from '../ProductInventoryTab';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  productsControllerGetComponents: jest.fn(),
  inventoryControllerFindByProductIdsBulk: jest.fn(),
  inventoryControllerFindAllLocations: jest.fn(),
  inventoryControllerFindBinsByLocation: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.quantity !== undefined) {
        return `${key}:${params.quantity}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductInventoryTab Component', () => {
  const mockTrackedKitProduct = {
    productId: 'kit-prod-1',
    productNumber: 'KIT-001',
    name: 'Tool Kit Pro',
    productType: 'inventory',
    structureType: 'kit',
  } as unknown as api.ProductResponseDto;

  const mockNonStockKitProduct = {
    productId: 'kit-prod-2',
    productNumber: 'KIT-002',
    name: 'Virtual Bundle',
    productType: 'non-stock',
    structureType: 'kit',
  } as unknown as api.ProductResponseDto;

  const mockStandardProduct = {
    productId: 'std-prod-1',
    productNumber: 'BOLT-001',
    name: 'M8 Bolt',
    productType: 'inventory',
    structureType: 'standard',
  } as unknown as api.ProductResponseDto;

  const mockComponents = [
    {
      childProductId: 'comp-1',
      productNumber: 'COMP-001',
      name: 'Component One',
      parentQuantity: 2,
    },
    {
      childProductId: 'comp-2',
      productNumber: 'COMP-002',
      name: 'Component Two',
      parentQuantity: 1,
    },
  ];

  const mockInventoryLevels = [
    {
      productId: 'comp-1',
      locationId: 'loc-1',
      locationName: 'Warehouse A',
      locationNo: 'WH-A',
      quantityOnHand: '10',
      quantityAvailable: '10',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
    },
    {
      productId: 'comp-2',
      locationId: 'loc-1',
      locationName: 'Warehouse A',
      locationNo: 'WH-A',
      quantityOnHand: '0',
      quantityAvailable: '0',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
    },
    {
      productId: 'comp-1',
      locationId: 'loc-2',
      locationName: 'Warehouse B',
      locationNo: 'WH-B',
      quantityOnHand: '10',
      quantityAvailable: '10',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
    },
    {
      productId: 'comp-2',
      locationId: 'loc-2',
      locationName: 'Warehouse B',
      locationNo: 'WH-B',
      quantityOnHand: '15',
      quantityAvailable: '15',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
    },
  ];

  const mockLocations = [
    {
      locationId: 'loc-1',
      code: 'WH-A',
      name: 'Warehouse A',
    },
    {
      locationId: 'loc-2',
      code: 'WH-B',
      name: 'Warehouse B',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerGetComponents as jest.Mock).mockResolvedValue({
      data: mockComponents,
    });
    (api.inventoryControllerFindByProductIdsBulk as jest.Mock).mockResolvedValue({
      data: mockInventoryLevels,
    });
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: mockLocations,
    });
    (api.inventoryControllerFindBinsByLocation as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('renders view switcher for tracked kit products and defaults to built view', async () => {
    render(
      <ProductInventoryTab
        productId="kit-prod-1"
        product={mockTrackedKitProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    // Verify main title and view tabs exist
    await waitFor(() => {
      expect(screen.getByText('products.inventoryLevels')).toBeInTheDocument();
      expect(screen.getByText('products.tabs.built')).toBeInTheDocument();
      expect(screen.getByText('products.tabs.kitComponents')).toBeInTheDocument();
    });

    // In default built view, addBinLink button is available and components badge is not
    expect(screen.getByText('products.storage.addBinLink')).toBeInTheDocument();
    expect(screen.queryByText(/products.availableToAssemble/)).not.toBeInTheDocument();
  });

  it('toggles to component view on tracked kit products when clicking Components tab', async () => {
    const user = userEvent.setup();

    render(
      <ProductInventoryTab
        productId="kit-prod-1"
        product={mockTrackedKitProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('products.tabs.kitComponents')).toBeInTheDocument();
    });

    // Switch to Components view
    await user.click(screen.getByText('products.tabs.kitComponents'));

    // Should now show the component breakdown table
    await waitFor(() => {
      expect(screen.getByText(/COMP-001/)).toBeInTheDocument();
      expect(screen.getByText(/COMP-002/)).toBeInTheDocument();
    });

    // Should display the available to assemble badge inside component view
    expect(screen.getByText(/products.availableToAssemble/)).toBeInTheDocument();

    // In component view, addBinLink button should be hidden
    expect(screen.queryByText('products.storage.addBinLink')).not.toBeInTheDocument();

    // Switch back to Built view
    await user.click(screen.getByText('products.tabs.built'));

    // Add bin link button should reappear
    await waitFor(() => {
      expect(screen.getByText('products.storage.addBinLink')).toBeInTheDocument();
    });
    expect(screen.queryByText(/products.availableToAssemble/)).not.toBeInTheDocument();
  });

  it('renders component view directly without tabs for non-stock kit products', async () => {
    render(
      <ProductInventoryTab
        productId="kit-prod-2"
        product={mockNonStockKitProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('products.inventoryLevels')).toBeInTheDocument();
      expect(screen.getByText(/COMP-001/)).toBeInTheDocument();
    });

    // Badge is displayed directly in component view
    expect(screen.getByText(/products.availableToAssemble/)).toBeInTheDocument();

    // Tabs should NOT be rendered
    expect(screen.queryByText('products.tabs.built')).not.toBeInTheDocument();
    expect(screen.queryByText('products.tabs.kitComponents')).not.toBeInTheDocument();
    expect(screen.queryByText('products.storage.addBinLink')).not.toBeInTheDocument();
  });

  it('renders built inventory view directly without tabs for standard products', async () => {
    render(
      <ProductInventoryTab
        productId="std-prod-1"
        product={mockStandardProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('products.inventoryLevels')).toBeInTheDocument();
      expect(screen.getByText('products.storage.addBinLink')).toBeInTheDocument();
    });

    // Tabs should NOT be rendered
    expect(screen.queryByText('products.tabs.built')).not.toBeInTheDocument();
    expect(screen.queryByText('products.tabs.kitComponents')).not.toBeInTheDocument();
    expect(screen.queryByText(/products.availableToAssemble/)).not.toBeInTheDocument();
  });

  it('pools parts across all locations for available to assemble when All Locations is selected, and filters by specific location', async () => {
    const user = userEvent.setup();

    render(
      <ProductInventoryTab
        productId="kit-prod-1"
        product={mockTrackedKitProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    // Switch to Components tab to view badge and dropdown
    await waitFor(() => {
      expect(screen.getByText('products.tabs.kitComponents')).toBeInTheDocument();
    });
    await user.click(screen.getByText('products.tabs.kitComponents'));

    // Initial "All Locations": comp-1 has 20 total (parentQty: 2 -> 10 buildable), comp-2 has 15 total (parentQty: 1 -> 15 buildable) -> 10 available
    await waitFor(() => {
      expect(screen.getByText('products.availableToAssemble:10')).toBeInTheDocument();
    });

    // Select Warehouse B (loc-2): comp-1 has 10 (parentQty: 2 -> 5 buildable), comp-2 has 15 (parentQty: 1 -> 15 buildable) -> 5 available
    const locationSelect = screen.getByRole('combobox');
    await user.selectOptions(locationSelect, 'loc-2');

    await waitFor(() => {
      expect(screen.getByText('products.availableToAssemble:5')).toBeInTheDocument();
    });
  });

  it('does not bleed kit child component inventory or bins into the built tab', async () => {
    (api.inventoryControllerFindByProductIdsBulk as jest.Mock).mockResolvedValue({
      data: [
        ...mockInventoryLevels, // comp-1 and comp-2 have stock in loc-1 and loc-2
        {
          productId: 'kit-prod-1',
          locationId: 'loc-1',
          locationName: 'Warehouse A',
          locationNo: 'WH-A',
          quantityOnHand: '3',
          quantityAvailable: '3',
          quantityCommitted: '0',
          quantityReserved: '0',
          quantityOnOrder: '0',
          binBalances: [{ binId: 'bin-kit-1', binNumber: 'KIT-BIN-1', quantityOnHand: 3 }],
        },
      ],
    });

    render(
      <ProductInventoryTab
        productId="kit-prod-1"
        product={mockTrackedKitProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('products.tabs.built')).toBeInTheDocument();
    });

    // On the "Built" tab:
    // Should show kit-prod-1's quantity (3) and bin (KIT-BIN-1) for Warehouse A
    expect(screen.getByText(/Warehouse A/)).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('KIT-BIN-1')).toBeInTheDocument();

    // Should NOT show Warehouse B (which only has child component stock)
    expect(screen.queryByText(/Warehouse B/)).not.toBeInTheDocument();
  });
});
