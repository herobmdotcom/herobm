import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TransferDetailsClient from '../TransferDetailsClient';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (ns?: string) => Object.assign(
    (key: string, params?: Record<string, unknown>) => {
      if (ns === 'transfers' && key === 'columns.destinationBin') return 'Destination Bin';
      if (ns === 'transfers' && key === 'columns.project') return 'Project';
      if (ns === 'transfers' && key === 'columns.sourceLocation') return 'Source Location';
      if (ns === 'transfers' && key === 'columns.destinationLocation') return 'Destination Location';
      if (params && 'source' in params && 'destination' in params) {
        return `From ${params.source} to ${params.destination}`;
      }
      return key;
    },
    { has: () => true }
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

jest.mock('@herobm/sdk', () => ({
  transfersControllerFindOne: jest.fn(),
  transfersControllerFindShipments: jest.fn(),
}));

describe('TransferDetailsClient — project & destination bin display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.transfersControllerFindShipments as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders destination bin and project link when transfer order is linked to a project', async () => {
    (api.transfersControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        transferOrderId: 'to-123',
        orderNumber: 'TO-20260920-001',
        stateCode: 'confirmed',
        sourceLocationId: 'loc-src',
        sourceLocationName: 'Main Warehouse',
        destinationLocationId: 'loc-dst',
        destinationLocationName: 'Job Site Facility',
        projectId: 'prj-789',
        projectNumber: 'PRJ-2026-001',
        projectName: 'Commercial Fitout',
        destinationBinId: 'bin-stg-01',
        destinationBinNumber: 'STG-FAB-01',
        createdBy: 'alice',
        createdOn: '2026-09-20T10:00:00Z',
        lines: [],
        events: [],
      },
    });

    render(<TransferDetailsClient id="to-123" />);

    await waitFor(() => {
      expect(screen.getByText('TO-20260920-001')).toBeInTheDocument();
    });

    expect(screen.getByText('Destination Bin')).toBeInTheDocument();
    expect(screen.getByText('STG-FAB-01')).toBeInTheDocument();

    expect(screen.getByText('Project')).toBeInTheDocument();
    const projectLink = screen.getByRole('link', { name: 'PRJ-2026-001 - Commercial Fitout' });
    expect(projectLink).toBeInTheDocument();
    expect(projectLink).toHaveAttribute('href', '/projects/prj-789');
  });

  it('does not render destination bin when not present on regular transfer order', async () => {
    (api.transfersControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        transferOrderId: 'to-456',
        orderNumber: 'TO-20260920-002',
        stateCode: 'confirmed',
        sourceLocationId: 'loc-src',
        sourceLocationName: 'Main Warehouse',
        destinationLocationId: 'loc-dst',
        destinationLocationName: 'Secondary Warehouse',
        createdBy: 'bob',
        createdOn: '2026-09-20T10:00:00Z',
        lines: [],
        events: [],
      },
    });

    render(<TransferDetailsClient id="to-456" />);

    await waitFor(() => {
      expect(screen.getByText('TO-20260920-002')).toBeInTheDocument();
    });

    expect(screen.queryByText('Destination Bin')).not.toBeInTheDocument();
    expect(screen.queryByText('Project')).not.toBeInTheDocument();
  });
});
