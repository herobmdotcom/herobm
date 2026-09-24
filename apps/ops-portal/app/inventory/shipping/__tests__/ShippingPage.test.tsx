import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ShippingPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (ns?: string) => Object.assign(
    (key: string, params?: Record<string, unknown>) => {
      if (ns === 'shipping' && key === 'buttons.createShipment') return 'Create Shipment';
      if (ns === 'shipping' && key === 'buttons.markAsDelivered') return 'Mark as Delivered';
      if (ns === 'shipping' && key === 'deliveryInstructions') return 'Delivery Instructions';
      if (ns === 'shipping' && key === 'columns.trackingNumber') return 'Tracking #';
      if (ns === 'shipping' && key === 'columns.shipmentNotes') return 'Shipment Notes';
      if (ns === 'shipping' && key === 'placeholders.tracking') return 'Tracking #';
      if (ns === 'shipping' && key === 'placeholders.shipmentNotes') return 'Internal shipment notes...';
      if (ns === 'shipping' && key === 'tabs.ready') return 'Ready';
      if (ns === 'shipping' && key === 'tabs.partial') return 'Partial';
      if (ns === 'shipping' && key === 'title') return 'Shipping';
      if (ns === 'shipping' && key === 'selectOrder') return 'Select an order to create a shipment.';
      return key;
    },
    { has: () => true }
  ),
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    app: { defaultFulfillmentLocationId: 'loc-main' },
  }),
}));

jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: (_key: string, defaultVal: string) => ['loc-main', jest.fn(), true],
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@herobm/sdk', () => ({
  inventoryControllerFindAllLocations: jest.fn(),
  orderPickingControllerGetShippingQueue: jest.fn(),
  orderPickingControllerGetShippingContext: jest.fn(),
  orderShipmentsControllerCreateShipment: jest.fn(),
}));

describe('ShippingPage — same-site transfer orders vs standard orders', () => {
  const mockLocations = [
    { locationId: 'loc-main', code: 'MAIN', name: 'Main Warehouse' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: mockLocations,
    });
  });

  it('hides shipping instructions and shows Mark as Delivered for same-site Transfer Orders', async () => {
    const sameSiteTO = {
      id: 'to-same-1',
      orderNumber: 'TO-SAME-001',
      name: 'Internal Relocation',
      customerName: 'Main Warehouse',
      customerOrderNumber: '',
      stateCode: 'picking',
      createdOn: '2026-09-20T10:00:00Z',
      createdBy: 'alice',
      currencyCode: null,
      shippabilityStatus: 'ready' as const,
      totalShippableLines: 1,
      totalLines: 1,
      type: 'transfer_order' as const,
      sourceLocationId: 'loc-main',
      destinationLocationId: 'loc-main',
      isSameSite: true,
    };

    (api.orderPickingControllerGetShippingQueue as jest.Mock).mockResolvedValue({
      data: [sameSiteTO],
    });

    (api.orderPickingControllerGetShippingContext as jest.Mock).mockResolvedValue({
      data: {
        order: {
          id: 'to-same-1',
          orderNumber: 'TO-SAME-001',
          name: 'Internal Relocation',
          type: 'transfer_order',
          sourceLocationId: 'loc-main',
          destinationLocationId: 'loc-main',
          isSameSite: true,
          shippingNotes: '',
        },
        lines: [
          {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: 'PROD-001',
            productDescription: 'Widget',
            isPhysical: true,
            quantity: '10',
            quantityPicked: '10',
            quantityShipped: '0',
            availableToShip: '10',
          },
        ],
        shipments: [],
      },
    });

    render(<ShippingPage />);

    await waitFor(() => {
      expect(screen.getByText('TO-SAME-001')).toBeInTheDocument();
    });

    // Select the order
    fireEvent.click(screen.getByText('TO-SAME-001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark as Delivered' })).toBeInTheDocument();
    });

    // Delivery Instructions and Tracking # must NOT be in the document
    expect(screen.queryByText('Delivery Instructions')).not.toBeInTheDocument();
    expect(screen.queryByText('Tracking #')).not.toBeInTheDocument();

    // Shipment Notes IS in the document
    expect(screen.getByText('Shipment Notes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Internal shipment notes...')).toBeInTheDocument();
  });

  it('shows shipping instructions and Create Shipment for standard inter-site / sales orders', async () => {
    const salesOrder = {
      id: 'so-1',
      orderNumber: 'SO-1001',
      name: 'Client Order',
      customerName: 'Acme Corp',
      customerOrderNumber: 'PO-99',
      stateCode: 'picking',
      createdOn: '2026-09-20T10:00:00Z',
      createdBy: 'alice',
      currencyCode: 'AUD',
      shippabilityStatus: 'ready' as const,
      totalShippableLines: 1,
      totalLines: 1,
      type: 'sales_order' as const,
      isSameSite: false,
    };

    (api.orderPickingControllerGetShippingQueue as jest.Mock).mockResolvedValue({
      data: [salesOrder],
    });

    (api.orderPickingControllerGetShippingContext as jest.Mock).mockResolvedValue({
      data: {
        order: {
          id: 'so-1',
          orderNumber: 'SO-1001',
          name: 'Client Order',
          type: 'sales_order',
          isSameSite: false,
          shippingNotes: 'Leave at front door',
        },
        lines: [
          {
            salesOrderLineId: 'line-so-1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: 'PROD-001',
            productDescription: 'Widget',
            isPhysical: true,
            quantity: '5',
            quantityPicked: '5',
            quantityShipped: '0',
            availableToShip: '5',
          },
        ],
        shipments: [],
      },
    });

    render(<ShippingPage />);

    await waitFor(() => {
      expect(screen.getByText('SO-1001')).toBeInTheDocument();
    });

    // Select the order
    fireEvent.click(screen.getByText('SO-1001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Shipment' })).toBeInTheDocument();
    });

    // Delivery Instructions, Tracking #, and Shipment Notes MUST all be present
    expect(screen.getByText('Delivery Instructions')).toBeInTheDocument();
    expect(screen.getByText('Tracking #')).toBeInTheDocument();
    expect(screen.getByText('Shipment Notes')).toBeInTheDocument();
  });
});
