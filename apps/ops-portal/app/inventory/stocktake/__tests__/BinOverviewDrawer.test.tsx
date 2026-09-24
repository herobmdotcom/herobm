import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BinOverviewDrawer from '../components/BinOverviewDrawer';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  stocktakesControllerFindLines: jest.fn(),
  setSdkConfig: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.counted !== undefined && params?.total !== undefined) {
        return `${key}:${params.counted}/${params.total}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

describe('BinOverviewDrawer Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectBin = jest.fn();

  const mockBins = [
    {
      binId: 'bin-1',
      binNumber: 'A-01-01',
      zoneCode: 'ZONE-A',
    },
    {
      binId: 'bin-2',
      binNumber: 'B-01-01',
      zoneCode: 'ZONE-B',
    },
    {
      binId: 'bin-3',
      binNumber: 'C-01-01',
      zoneCode: 'ZONE-C',
    },
  ];

  const mockLines = [
    {
      stocktakeLineId: 'line-1',
      productId: 'prod-1',
      productNumber: 'SKU-001',
      productName: 'Widget A',
      binId: 'bin-1',
      binNumber: 'A-01-01',
      expectedQuantity: '10',
      countedQuantity: null,
      baseUom: 'EA',
    },
    {
      stocktakeLineId: 'line-2',
      productId: 'prod-2',
      productNumber: 'SKU-002',
      productName: 'Widget B',
      binId: 'bin-2',
      binNumber: 'B-01-01',
      expectedQuantity: '20',
      countedQuantity: '20',
      baseUom: 'EA',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.stocktakesControllerFindLines as jest.Mock).mockResolvedValue({
      data: mockLines,
    });
  });

  it('fetches all lines when stocktakeId is provided and renders correct bin statuses', async () => {
    render(
      <BinOverviewDrawer
        isOpen={true}
        onClose={mockOnClose}
        bins={mockBins}
        stocktakeId="stk-123"
        activeBinId="bin-1"
        confirmedEmptyBinIds={['bin-3']}
        onSelectBin={mockOnSelectBin}
      />,
    );

    await waitFor(() => {
      expect(api.stocktakesControllerFindLines).toHaveBeenCalledWith('stk-123', {
        limit: 5000,
      });
    });

    // bin-1 has uncounted line
    expect(screen.getByText('A-01-01')).toBeInTheDocument();
    expect(screen.getByText('binStatus.uncounted')).toBeInTheDocument();

    // bin-2 has counted line
    expect(screen.getByText('B-01-01')).toBeInTheDocument();
    expect(screen.getByText('binStatus.counted')).toBeInTheDocument();

    // bin-3 has 0 lines and is confirmed empty
    expect(screen.getByText('C-01-01')).toBeInTheDocument();
    expect(screen.getByText('binStatus.confirmedEmpty')).toBeInTheDocument();
  });

  it('renders bins list and selects bin when clicked', async () => {
    const user = userEvent.setup();

    render(
      <BinOverviewDrawer
        isOpen={true}
        onClose={mockOnClose}
        bins={mockBins}
        stocktakeId="stk-123"
        activeBinId="bin-1"
        onSelectBin={mockOnSelectBin}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('A-01-01')).toBeInTheDocument();
    });

    // Select second bin
    await user.click(screen.getByText('B-01-01'));

    expect(mockOnSelectBin).toHaveBeenCalledWith('bin-2');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('filters bins based on search input', async () => {
    const user = userEvent.setup();

    render(
      <BinOverviewDrawer
        isOpen={true}
        onClose={mockOnClose}
        bins={mockBins}
        stocktakeId="stk-123"
        activeBinId="bin-1"
        onSelectBin={mockOnSelectBin}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('A-01-01')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('searchBinsPlaceholder');
    await user.type(searchInput, 'ZONE-B');

    expect(screen.queryByText('A-01-01')).not.toBeInTheDocument();
    expect(screen.getByText('B-01-01')).toBeInTheDocument();
  });
});
