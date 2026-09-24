import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import EditShipmentClient from '../EditShipmentClient';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, any>) => {
    if (ns === 'shipments') {
      if (key === 'columns.customer') return 'Customer';
      if (key === 'columns.deliveredToBin') return 'Delivered to Bin';
      if (key === 'columns.destinationBin') return 'Destination Bin';
      if (key === 'columns.project') return 'Project';
      if (key === 'columns.tracking') return 'Tracking';
      if (key === 'columns.date') return 'Date';
      if (key === 'columns.notes') return 'Notes';
      if (key === 'columns.orderNumber') return 'Order #';
      if (key === 'columns.product') return 'Product';
      if (key === 'columns.description') return 'Description';
      if (key === 'columns.qty') return 'Qty';
      if (key === 'shipmentDetails') return 'Shipment Details';
      if (key === 'lineItems') return 'Line Items';
      if (key === 'docketPdf') return 'Print Docket';
      if (key === 'emailDocket') return 'Email Docket';
      if (key === 'labelPdf') return 'Print Label';
      if (key === 'shipmentLines') return `${params?.count} lines`;
    }
    if (ns === 'common') {
      if (key === 'by') return 'by';
      if (key === 'system') return 'system';
      if (key === 'notesCardHeading') return 'Notes';
      if (key === 'loading') return 'Loading...';
      if (key === 'orderReadView.noLineItems') return 'No line items';
    }
    return key;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/components/StateBadge', () => {
  return function MockStateBadge({ state }: { state: string }) {
    return <span data-testid="state-badge">{state}</span>;
  };
});

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  globalShipmentsControllerFindOne: jest.fn(),
}));

describe('EditShipmentClient', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders same-site transfer order shipment with delivered-to bin and project details', async () => {
    const mockTransferShipment = {
      shipmentId: 'ship-to-01',
      shipmentNumber: 'TSH-20260920-0001',
      salesOrderId: 'to-01',
      orderNumber: 'TO-1001',
      customerId: 'loc-01',
      customerName: 'Perth WA',
      stateCode: 'dispatched',
      notes: 'Internal project delivery',
      trackingNumber: null,
      createdOn: '2026-09-20T12:00:00Z',
      createdBy: 'admin',
      isSameSite: true,
      sourceLocationId: 'loc-01',
      destinationLocationId: 'loc-01',
      projectId: 'proj-01',
      projectNumber: 'FRE-PROJ-001',
      projectName: 'FF Expansion Ph 1',
      destinationBinId: 'bin-01',
      destinationBinNumber: 'L2.13.3',
      lines: [
        {
          shipmentLineId: 'line-01',
          salesOrderLineId: 'to-line-01',
          quantityShipped: '10',
          productId: 'prod-01',
          productNumber: 'BOLT-M8',
          productDescription: 'Hex Bolt M8',
          orderNumber: 'TO-1001',
        },
      ],
      events: [],
    };

    (api.globalShipmentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: mockTransferShipment,
    });

    render(<EditShipmentClient id="ship-to-01" />);

    await waitFor(() => {
      expect(screen.getByText('TSH-20260920-0001')).toBeInTheDocument();
    });

    // Customer / Location
    expect(screen.getByText('Perth WA')).toBeInTheDocument();

    // Delivered to Bin label and bin number
    expect(screen.getByText('Delivered to Bin')).toBeInTheDocument();
    expect(screen.getByText('L2.13.3')).toBeInTheDocument();

    // Project label and link
    expect(screen.getByText('Project')).toBeInTheDocument();
    const projectLink = screen.getByRole('link', { name: 'FRE-PROJ-001 - FF Expansion Ph 1' });
    expect(projectLink).toBeInTheDocument();
    expect(projectLink).toHaveAttribute('href', '/projects/proj-01');

    // Tracking should be omitted for same-site TO
    expect(screen.queryByText('Tracking')).not.toBeInTheDocument();

    // Line items
    expect(screen.getAllByText('BOLT-M8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hex Bolt M8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
  });

  it('renders standard sales order shipment with tracking number and address', async () => {
    const mockSalesShipment = {
      shipmentId: 'ship-so-01',
      shipmentNumber: 'SHP-20260920-0001',
      salesOrderId: 'so-01',
      orderNumber: 'SO-2001',
      customerId: 'cust-01',
      customerName: 'Acme Corp',
      stateCode: 'dispatched',
      notes: 'Deliver to rear bay',
      trackingNumber: 'TRK-987654',
      createdOn: '2026-09-20T12:00:00Z',
      createdBy: 'admin',
      isSameSite: false,
      deliveryAddressLine1: '123 Industrial Rd',
      deliveryCity: 'Perth',
      deliveryState: 'WA',
      deliveryPostalCode: '6000',
      deliveryCountry: 'Australia',
      lines: [
        {
          shipmentLineId: 'line-01',
          salesOrderLineId: 'so-line-01',
          quantityShipped: '5',
          productId: 'prod-01',
          productNumber: 'BOLT-M8',
          productDescription: 'Hex Bolt M8',
          orderNumber: 'SO-2001',
        },
      ],
      events: [],
    };

    (api.globalShipmentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: mockSalesShipment,
    });

    render(<EditShipmentClient id="ship-so-01" />);

    await waitFor(() => {
      expect(screen.getByText('SHP-20260920-0001')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Tracking')).toBeInTheDocument();
    expect(screen.getByText('TRK-987654')).toBeInTheDocument();
    expect(screen.queryByText('Delivered to Bin')).not.toBeInTheDocument();
  });
});
