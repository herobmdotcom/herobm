import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StocktakeClient, { matchBinPrefix } from '../StocktakeClient';
import * as api from '@herobm/sdk';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/inventory/stocktakes/stk-test-123',
}));

jest.mock('@herobm/sdk', () => ({
  stocktakesControllerFindOne: jest.fn(),
  stocktakesControllerFindLines: jest.fn(),
  stocktakesControllerRecordCount: jest.fn(),
  stocktakesControllerRecordBatchCounts: jest.fn(),
  stocktakesControllerAddUnlistedProduct: jest.fn(),
  stocktakesControllerUpdateLine: jest.fn(),
  stocktakesControllerSubmit: jest.fn(),
  stocktakesControllerChangeState: jest.fn(),
  inventoryControllerFindBinsByLocation: jest.fn(),
  productsControllerFindAll: jest.fn(),
}));

jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User' },
    permissions: [
      { resource: 'inventory', action: 'read', effect: 'allow' },
      { resource: 'inventory', action: 'write', effect: 'allow' },
    ],
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) {
        return `${key}:${params.count}`;
      }
      if (params?.bin !== undefined) {
        return `${key}:${params.bin}`;
      }
      if (params?.current !== undefined && params?.total !== undefined) {
        return `${key}:${params.current}/${params.total}`;
      }
      if (params?.number !== undefined) {
        return `${key}:${params.number}`;
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
    custom: jest.fn(),
  },
}));

// Mock Web Audio API
class AudioContextMock {
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
    };
  }
  get destination() {
    return {};
  }
  get currentTime() {
    return 0;
  }
}

(window as unknown as { AudioContext: unknown; webkitAudioContext: unknown }).AudioContext = AudioContextMock;
(window as unknown as { AudioContext: unknown; webkitAudioContext: unknown }).webkitAudioContext = AudioContextMock;

describe('StocktakeClient Component (Server-Backed & Per-Bin Loading)', () => {
  const mockStocktake = {
    stocktakeId: 'stk-test-123',
    stocktakeNumber: 'STK-20260915-0001',
    name: 'Q3 Warehouse Stocktake',
    locationId: 'loc-1',
    locationCode: 'WH-MAIN',
    locationName: 'Main Warehouse',
    stateCode: 'open',
    scopeType: 'full',
    zoneFilter: null,
    binPattern: null,
    isBlindCount: false,
    notes: 'Test instructions',
    totalLines: 3,
    countedLines: 0,
    discrepancyLines: 0,
    progressPercentage: 0,
  };

  const mockBins = [
    { binId: 'bin-1', binNumber: 'A-01-01', zoneCode: 'ZONE-A' },
    { binId: 'bin-2', binNumber: 'B-02-01', zoneCode: 'ZONE-B' },
  ];

  const mockLinesBin1 = [
    {
      stocktakeLineId: 'line-1',
      stocktakeId: 'stk-test-123',
      productId: 'prod-1',
      productNumber: 'SKU-001',
      productName: 'Precision Widget',
      barcode: '111222333',
      binId: 'bin-1',
      binNumber: 'A-01-01',
      expectedQuantity: '10',
      countedQuantity: null,
      isUnlisted: false,
      baseUom: 'PCS',
    },
    {
      stocktakeLineId: 'line-2',
      stocktakeId: 'stk-test-123',
      productId: 'prod-2',
      productNumber: 'SKU-002',
      productName: 'Heavy Gear',
      barcode: '444555666',
      binId: 'bin-1',
      binNumber: 'A-01-01',
      expectedQuantity: '20',
      countedQuantity: null,
      isUnlisted: false,
      baseUom: 'PCS',
    },
  ];

  const mockLinesBin2 = [
    {
      stocktakeLineId: 'line-3',
      stocktakeId: 'stk-test-123',
      productId: 'prod-3',
      productNumber: 'SKU-003',
      productName: 'Solar Inverter',
      barcode: '777888999',
      binId: 'bin-2',
      binNumber: 'B-02-01',
      expectedQuantity: '5',
      countedQuantity: null,
      isUnlisted: false,
      baseUom: 'EA',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    (api.stocktakesControllerFindOne as jest.Mock).mockResolvedValue({
      data: mockStocktake,
    });
    (api.inventoryControllerFindBinsByLocation as jest.Mock).mockResolvedValue({
      data: mockBins,
    });
    (api.stocktakesControllerFindLines as jest.Mock).mockImplementation((_id, query) => {
      if (query?.binId === 'bin-2') {
        return Promise.resolve({ data: mockLinesBin2 });
      }
      if (query?.binId === 'bin-1') {
        return Promise.resolve({ data: mockLinesBin1 });
      }
      if (query?.status === 'all' || query?.status === 'counted' || query?.limit === 2000) {
        return Promise.resolve({
          data: [
            { ...mockLinesBin1[0], countedQuantity: '1' },
            { ...mockLinesBin1[1], countedQuantity: '20' },
          ],
        });
      }
      return Promise.resolve({ data: mockLinesBin1 });
    });
    (api.stocktakesControllerRecordCount as jest.Mock).mockResolvedValue({
      data: { stocktakeLineId: 'line-1' },
    });
    (api.stocktakesControllerRecordBatchCounts as jest.Mock).mockResolvedValue({
      data: [],
    });
    (api.stocktakesControllerAddUnlistedProduct as jest.Mock).mockResolvedValue({
      data: { stocktakeLineId: 'line-new' },
    });
    (api.stocktakesControllerSubmit as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
    (api.stocktakesControllerChangeState as jest.Mock).mockResolvedValue({
      data: { stateCode: 'review' },
    });
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('loads stocktake entity and displays items for the default active bin (A-01-01)', async () => {
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(api.stocktakesControllerFindOne).toHaveBeenCalledWith('stk-test-123');
      expect(api.inventoryControllerFindBinsByLocation).toHaveBeenCalledWith('loc-1', {});
    });

    await waitFor(() => {
      expect(api.stocktakesControllerFindLines).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({ binId: 'bin-1' }),
      );
    });

    // Active bin items should now be rendered (SKU-001 and SKU-002 in bin-1)
    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.getByText('SKU-002')).toBeInTheDocument();
    });

    // SKU-003 is in bin-2, so it should not be in the active bin view
    expect(screen.queryByText('SKU-003')).not.toBeInTheDocument();
  });

  it('navigates to next bin and dynamically fetches that bin items', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Click "Next Bin"
    const nextBtn = screen.getByRole('button', { name: 'nextBin' });
    await user.click(nextBtn);

    // Should dynamically fetch lines for bin-2
    await waitFor(() => {
      expect(api.stocktakesControllerFindLines).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({ binId: 'bin-2' }),
      );
    });

    // Active bin should now be B-02-01 with SKU-003
    await waitFor(() => {
      expect(screen.getByText('SKU-003')).toBeInTheDocument();
      expect(screen.queryByText('SKU-001')).not.toBeInTheDocument();
    });

    // Click "Previous Bin"
    const prevBtn = screen.getByRole('button', { name: 'previousBin' });
    await user.click(prevBtn);

    // Active bin returns to A-01-01
    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.queryByText('SKU-003')).not.toBeInTheDocument();
    });
  });

  it('marks active bin as Done, syncing zero batch counts to backend', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Click "Done" in the Items card toolbar
    const doneBtn = screen.getByRole('button', { name: 'done' });
    await user.click(doneBtn);

    // Should call batch counts with 0 for uncounted lines
    await waitFor(() => {
      expect(api.stocktakesControllerRecordBatchCounts).toHaveBeenCalledWith(
        'stk-test-123',
        {
          counts: [
            { productId: 'prod-1', binId: 'bin-1', quantity: '0' },
            { productId: 'prod-2', binId: 'bin-1', quantity: '0' },
          ],
        },
      );
    });

    // Active bin advances to B-02-01
    await waitFor(() => {
      expect(screen.getByText('SKU-003')).toBeInTheDocument();
    });
  });

  it('opens Bin Overview drawer and selects a bin', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Click "Bin Overview"
    const overviewBtn = screen.getByRole('button', { name: /binOverview/i });
    await user.click(overviewBtn);

    // Find and click B-02-01 in drawer
    const bin2Entries = screen.getAllByText('B-02-01');
    await user.click(bin2Entries[bin2Entries.length - 1]);

    // Active bin should now be B-02-01 with SKU-003
    await waitFor(() => {
      expect(screen.getByText('SKU-003')).toBeInTheDocument();
    });
  });

  it('switches active bin immediately when scanning a bin barcode', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Type bin barcode into the scanner input and submit (press Enter)
    const scanInput = screen.getByPlaceholderText('scanInputPlaceholder');
    await user.type(scanInput, 'B-02-01{enter}');

    // Active bin should now switch to B-02-01 with SKU-003
    await waitFor(() => {
      expect(screen.getByText('SKU-003')).toBeInTheDocument();
      expect(screen.queryByText('SKU-001')).not.toBeInTheDocument();
    });
  });

  it('increments item count and syncs count to server when scanning product barcode in active bin', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.getByText('SKU-002')).toBeInTheDocument();
    });

    // Scan SKU-002 barcode (444555666)
    const scanInput = screen.getByPlaceholderText('scanInputPlaceholder');
    await user.type(scanInput, '444555666{enter}');

    // Should call recordCount
    await waitFor(() => {
      expect(api.stocktakesControllerRecordCount).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({
          productId: 'prod-2',
          binId: 'bin-1',
          quantity: '1',
        }),
      );
    });
  });

  it('records catalog product scanned as unlisted item in current active bin', async () => {
    const user = userEvent.setup();
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          productId: 'prod-catalog',
          productNumber: 'SKU-CATALOG',
          name: 'New Product',
          barcode: '999888777',
          productType: 'inventory',
        },
      ],
    });

    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Scan barcode not in active bin
    const scanInput = screen.getByPlaceholderText('scanInputPlaceholder');
    await user.type(scanInput, '999888777{enter}');

    // Should call addUnlistedProduct
    await waitFor(() => {
      expect(api.stocktakesControllerAddUnlistedProduct).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({
          productId: 'prod-catalog',
          binId: 'bin-1',
          countedQuantity: '1',
        }),
      );
    });

    // Should render unlisted item in active bin
    await waitFor(() => {
      expect(screen.getByText('SKU-CATALOG')).toBeInTheDocument();
    });
  });

  it('handles item increment, opening review modal, and submitting reconciliation', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Count item 1 with +1 button in sticky footer
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add 1 to count' })).toBeInTheDocument();
    });
    const plusOneBtn = screen.getByRole('button', { name: 'Add 1 to count' });
    await user.click(plusOneBtn);

    // Click Review button in header
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'reviewButton' })).not.toBeDisabled();
    });
    const reviewBtn = screen.getByRole('button', { name: 'reviewButton' });
    await user.click(reviewBtn);

    await waitFor(() => {
      expect(api.stocktakesControllerChangeState).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({
          stateCode: 'review',
        }),
      );
    });

    // Review modal should now be open
    await waitFor(() => {
      expect(screen.getByText('review.title')).toBeInTheDocument();
    });

    // Commit adjustments in Review modal
    const commitBtn = screen.getByRole('button', { name: /commitAdjustments/i });
    await user.click(commitBtn);

    await waitFor(() => {
      expect(api.stocktakesControllerSubmit).toHaveBeenCalledWith(
        'stk-test-123',
        expect.objectContaining({
          reason: expect.stringContaining('Physical Stocktake'),
        }),
      );
    });

    // Completed summary view should be rendered
    await waitFor(() => {
      expect(screen.getByText('completed.title')).toBeInTheDocument();
    });
  });

  it('aligns blind count and audio toggles without using primary green CTA styles', async () => {
    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    // Both buttons should not have font-bold primary CTA class
    const blindBtn = screen.getByRole('button', { name: 'blindCount' });
    const soundBtn = screen.getByRole('button', { name: 'muteSound' });

    expect(blindBtn).not.toHaveClass('font-bold');
    expect(soundBtn).not.toHaveClass('font-bold');

    // Default state: Sound ON (aria-pressed true), Blind Count OFF (aria-pressed false)
    expect(soundBtn).toHaveAttribute('aria-pressed', 'true');
    expect(blindBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggle Blind Count ON
    await user.click(blindBtn);
    expect(blindBtn).toHaveAttribute('aria-pressed', 'true');
    expect(blindBtn).not.toHaveClass('font-bold');
    // Blind count badge should now be visible in the first card
    expect(screen.getByText('blindCountDiscrepancyMasked')).toBeInTheDocument();

    // Toggle Sound OFF
    await user.click(soundBtn);
    expect(soundBtn).toHaveAttribute('aria-pressed', 'false');
    expect(soundBtn).not.toHaveClass('font-bold');
  });

  it('allows reopening stocktake for counting when stocktake is in review state', async () => {
    (api.stocktakesControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        ...mockStocktake,
        stateCode: 'review',
        countedLines: 3,
      },
    });

    const user = userEvent.setup();
    render(<StocktakeClient stocktakeId="stk-test-123" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'reopen' })).toBeInTheDocument();
    });

    const reopenBtn = screen.getByRole('button', { name: 'reopen' });
    await user.click(reopenBtn);

    await waitFor(() => {
      expect(api.stocktakesControllerChangeState).toHaveBeenCalledWith('stk-test-123', {
        stateCode: 'open',
      });
    });
  });
});

describe('matchBinPrefix helper', () => {
  const sampleBin = { binNumber: 'A-01-01', zoneCode: 'ZONE-A' };

  it('matches valid prefixes on binNumber', () => {
    expect(matchBinPrefix(sampleBin, 'A')).toBe(true);
    expect(matchBinPrefix(sampleBin, 'A-01')).toBe(true);
    expect(matchBinPrefix(sampleBin, 'a-01-01')).toBe(true);
  });

  it('matches valid prefixes on zoneCode', () => {
    expect(matchBinPrefix(sampleBin, 'ZONE')).toBe(true);
    expect(matchBinPrefix(sampleBin, 'zone-a')).toBe(true);
  });

  it('matches location-qualified prefix', () => {
    expect(matchBinPrefix(sampleBin, 'WH-MAIN.A', 'WH-MAIN')).toBe(true);
    expect(matchBinPrefix(sampleBin, 'WH-MAIN.A-01', 'WH-MAIN')).toBe(true);
  });

  it('does NOT match middle-of-string substrings (strict prefix only)', () => {
    expect(matchBinPrefix(sampleBin, '01')).toBe(false);
    expect(matchBinPrefix(sampleBin, 'ONE-A')).toBe(false);
    expect(matchBinPrefix(sampleBin, 'B')).toBe(false);
  });

  it('returns true for empty or whitespace-only prefix', () => {
    expect(matchBinPrefix(sampleBin, '')).toBe(true);
    expect(matchBinPrefix(sampleBin, '   ')).toBe(true);
  });
});
