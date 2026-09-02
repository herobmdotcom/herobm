import React from 'react';
import { render, screen } from '@testing-library/react';
import AvailabilityTab from '../AvailabilityTab';

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      'availability.colLineNumber': '#',
      'availability.colProduct': 'Product',
      'availability.colDescription': 'Description',
      'availability.colQty': 'Qty',
      'availability.colStatus': 'Status',
      'availability.colLocation': 'Location',
      'availability.colOnHand': 'On Hand',
      'availability.colCommitted': 'Committed',
      'availability.colOrdered': 'On Order',
      'availability.colReserved': 'Reserved',
      'availability.colAvail': 'Available',
      'availability.thisOrder': 'This Order',
      'availability.loading': 'Loading inventory data...',
      'availability.noLineItems': 'No line items available.',
      'availability.noInventoryFound': 'No inventory found',
      'availability.noInventoryData': 'No inventory records',
      'availability.nonStock': 'Non-Stock Item',
      'availability.noStockTracking': 'Not stocked in warehouse bins',
      'availability.kitParent': 'Kit Parent',
      'availability.fulfilledByComponents': 'Fulfilled by kit components',
      'availability.component': 'Component',
      'availability.statusLocal': 'In Stock',
      'availability.statusOthers': 'In Stock (Other)',
      'availability.statusShortage': 'Shortage',
      'availability.statusPicked': 'Picked',
      'availability.statusShipped': 'Shipped',
      'availability.statusBackordered': 'Backordered',
      'availability.statusAtRisk': 'At Risk',
      'availability.statusNonStock': 'Non-Stock',
      'availability.statusKitParent': 'Kit Parent',
    };
    return messages[key] || key;
  },
}));

describe('AvailabilityTab Component', () => {
  const sampleInventory = [
    {
      productId: 'prod-1',
      locationId: 'loc-1',
      locationName: 'Main Warehouse',
      quantityOnHand: 50,
      quantityCommitted: 10,
      quantityReserved: 0,
      quantityOnOrder: 20,
      quantityAvailable: 40,
    },
    {
      productId: 'prod-1',
      locationId: 'loc-2',
      locationName: 'Secondary Hub',
      quantityOnHand: 20,
      quantityCommitted: 0,
      quantityReserved: 0,
      quantityOnOrder: 0,
      quantityAvailable: 20,
    },
    {
      productId: 'comp-1',
      locationId: 'loc-1',
      locationName: 'Main Warehouse',
      quantityOnHand: 100,
      quantityCommitted: 10,
      quantityReserved: 0,
      quantityOnOrder: 0,
      quantityAvailable: 90,
    },
  ];

  it('renders loading state when inventoryLoading is true', () => {
    render(
      <AvailabilityTab
        lines={[]}
        inventoryData={[]}
        inventoryLoading={true}
      />
    );
    expect(screen.getByText('Loading inventory data...')).toBeInTheDocument();
  });

  it('renders empty state when there are no lines', () => {
    render(
      <AvailabilityTab
        lines={[]}
        inventoryData={[]}
        inventoryLoading={false}
      />
    );
    expect(screen.getAllByText('No line items available.').length).toBeGreaterThanOrEqual(1);
  });

  it('filters out zero-quantity lines and service/freight lines', () => {
    const lines = [
      {
        id: 'line-1',
        lineNumber: 1,
        productId: 'prod-1',
        productNumber: 'PROD-001',
        productDescription: 'Tracked Product',
        quantity: 5,
        productType: 'inventory',
      },
      {
        id: 'line-2',
        lineNumber: 2,
        productId: 'prod-zero',
        productNumber: 'PROD-ZERO',
        productDescription: 'Zero Qty Line',
        quantity: 0,
        productType: 'inventory',
      },
      {
        id: 'line-3',
        lineNumber: 3,
        productId: 'prod-service',
        productNumber: 'SRV-001',
        productDescription: 'Installation Service',
        quantity: 1,
        productType: 'service',
      },
      {
        id: 'line-4',
        lineNumber: 4,
        productId: 'prod-freight',
        productNumber: 'FRT-001',
        productDescription: 'Freight Delivery',
        quantity: 1,
        productType: 'freight',
      },
    ];

    render(
      <AvailabilityTab
        lines={lines}
        inventoryData={sampleInventory}
        inventoryLoading={false}
        context="sales"
      />
    );

    expect(screen.getAllByText('PROD-001').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('PROD-ZERO')).not.toBeInTheDocument();
    expect(screen.queryByText('SRV-001')).not.toBeInTheDocument();
    expect(screen.queryByText('FRT-001')).not.toBeInTheDocument();
  });

  it('renders Kit Parent and Component lines with proper hierarchy and neutral non-error labels', () => {
    const lines = [
      {
        salesOrderLineId: 'kit-parent-1',
        lineNumber: 1,
        productId: 'kit-prod-1',
        productNumber: 'KIT-SOLAR-01',
        productDescription: 'Complete Solar Kit',
        quantity: 2,
        productType: 'non-stock',
        structureType: 'kit',
        parentLineId: null,
      },
      {
        salesOrderLineId: 'comp-child-1',
        lineNumber: 2,
        productId: 'comp-1',
        productNumber: 'PANEL-300W',
        productDescription: '300W Solar Panel',
        quantity: 4,
        productType: 'inventory',
        parentLineId: 'kit-parent-1',
      },
    ];

    render(
      <AvailabilityTab
        lines={lines}
        inventoryData={sampleInventory}
        inventoryLoading={false}
        context="sales"
        targetLocationId="loc-1"
      />
    );

    // Verify Kit Parent renders neutral "Kit Parent" status and "Fulfilled by kit components"
    expect(screen.getAllByText('KIT-SOLAR-01').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kit Parent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fulfilled by kit components').length).toBeGreaterThanOrEqual(1);
    // Should NOT say "No inventory found" in red for the kit parent!
    expect(screen.queryByText('No inventory found')).not.toBeInTheDocument();

    // Verify Component child line renders with component indicator and real inventory
    expect(screen.getAllByText('PANEL-300W').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Component').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('90').length).toBeGreaterThanOrEqual(1);
  });

  it('renders standalone non-stock items with neutral status', () => {
    const lines = [
      {
        salesOrderLineId: 'non-stock-1',
        lineNumber: 1,
        productId: 'ns-prod-1',
        productNumber: 'CUSTOM-CUT-PIPE',
        productDescription: 'Custom Length Pipe',
        quantity: 1,
        productType: 'non-stock',
      },
    ];

    render(
      <AvailabilityTab
        lines={lines}
        inventoryData={[]}
        inventoryLoading={false}
        context="sales"
      />
    );

    expect(screen.getAllByText('CUSTOM-CUT-PIPE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Non-Stock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Not stocked in warehouse bins/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No inventory found')).not.toBeInTheDocument();
  });

  it('renders Purchase mode with detailed balance columns', () => {
    const lines = [
      {
        purchaseOrderLineId: 'po-line-1',
        lineNumber: 1,
        productId: 'prod-1',
        productNumber: 'PROD-001',
        productDescription: 'Tracked Product',
        quantity: 10,
        productType: 'inventory',
      },
    ];

    render(
      <AvailabilityTab
        lines={lines}
        inventoryData={sampleInventory}
        inventoryLoading={false}
        context="purchase"
        targetLocationId="loc-1"
      />
    );

    // Should render table headers / labels for purchase mode
    expect(screen.getAllByText('This Order').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('On Hand').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Committed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('On Order').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reserved').length).toBeGreaterThanOrEqual(1);

    // Check balances for loc-1
    expect(screen.getAllByText('Main Warehouse').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1); // onHand
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1); // committed
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1); // onOrder
    expect(screen.getAllByText('40').length).toBeGreaterThanOrEqual(1); // available
    expect(screen.queryByText('✓')).not.toBeInTheDocument(); // No status column in purchase mode
  });
});
