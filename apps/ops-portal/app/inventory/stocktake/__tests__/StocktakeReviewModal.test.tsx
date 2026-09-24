import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StocktakeReviewModal from '../components/StocktakeReviewModal';
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
      if (params?.count !== undefined) {
        return `${key}:${params.count}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

describe('StocktakeReviewModal Component', () => {
  const mockLines = [
    {
      stocktakeLineId: 'bin-3_prod-1',
      productId: 'prod-1',
      productNumber: 'SKU-001',
      productName: 'Product 1',
      binId: 'bin-3',
      binNumber: 'A1.10',
      expectedQuantity: '5',
      countedQuantity: '6',
      baseUom: 'EA',
    },
    {
      stocktakeLineId: 'bin-1_prod-2',
      productId: 'prod-2',
      productNumber: 'SKU-002',
      productName: 'Product 2',
      binId: 'bin-1',
      binNumber: 'A1.2',
      expectedQuantity: '10',
      countedQuantity: '8',
      baseUom: 'EA',
    },
    {
      stocktakeLineId: 'bin-2_prod-3',
      productId: 'prod-3',
      productNumber: 'SKU-003',
      productName: 'Product 3',
      binId: 'bin-2',
      binNumber: 'A1.1',
      expectedQuantity: '4',
      countedQuantity: '4', // match (no discrepancy)
      baseUom: 'EA',
    },
    {
      stocktakeLineId: 'bin-4_prod-4',
      productId: 'prod-4',
      productNumber: 'SKU-004',
      productName: 'Product 4',
      binId: 'bin-4',
      binNumber: 'A2.1',
      expectedQuantity: '2',
      countedQuantity: '3',
      baseUom: 'EA',
    },
    {
      stocktakeLineId: 'bin-5_prod-5',
      productId: 'prod-5',
      productNumber: 'SKU-005',
      productName: 'Product 5',
      binId: 'bin-5',
      binNumber: 'A1.12',
      expectedQuantity: '7',
      countedQuantity: '9',
      baseUom: 'EA',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.stocktakesControllerFindLines as jest.Mock).mockResolvedValue({
      data: mockLines,
    });
  });

  it('renders report lines naturally ordered by bin number in variances view', async () => {
    render(
      <StocktakeReviewModal
        isOpen={true}
        onClose={jest.fn()}
        stocktakeId="stk-123"
        locationCode="WH-MAIN"
        canWrite={true}
        onSubmitReconciliation={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(api.stocktakesControllerFindLines).toHaveBeenCalledWith('stk-123', {
        limit: 2000,
      });
    });

    // Variances table should contain discrepant items sorted naturally: A1.2, A1.10, A1.12, A2.1
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Header row is index 0
      const binCells = rows.slice(1).map((r) => r.querySelectorAll('td')[1]?.textContent?.trim());
      expect(binCells).toEqual(['A1.2', 'A1.10', 'A1.12', 'A2.1']);
    });
  });

  it('renders all counted lines naturally ordered by bin number when toggled to all counted tab', async () => {
    const user = userEvent.setup();
    render(
      <StocktakeReviewModal
        isOpen={true}
        onClose={jest.fn()}
        stocktakeId="stk-123"
        locationCode="WH-MAIN"
        canWrite={true}
        onSubmitReconciliation={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'review.tabAllCounted:5' })).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('tab', { name: 'review.tabAllCounted:5' });
    await user.click(toggleBtn);

    // All counted items sorted naturally: A1.1, A1.2, A1.10, A1.12, A2.1
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const binCells = rows.slice(1).map((r) => r.querySelectorAll('td')[1]?.textContent?.trim());
      expect(binCells).toEqual(['A1.1', 'A1.2', 'A1.10', 'A1.12', 'A2.1']);
    });
  });

  it('displays blocking alert, renders uncounted tab by default, and disables submit button when uncounted lines exist', async () => {
    (api.stocktakesControllerFindLines as jest.Mock).mockResolvedValue({
      data: [
        ...mockLines,
        {
          stocktakeLineId: 'uncounted-1',
          productId: 'prod-uncounted',
          productNumber: 'SKU-UNCOUNTED',
          productName: 'Uncounted Product',
          binId: 'bin-6',
          binNumber: 'A3.1',
          expectedQuantity: '5',
          countedQuantity: null, // Uncounted
          baseUom: 'EA',
        },
      ],
    });

    render(
      <StocktakeReviewModal
        isOpen={true}
        onClose={jest.fn()}
        stocktakeId="stk-123"
        locationCode="WH-MAIN"
        canWrite={true}
        onSubmitReconciliation={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('uncountedBlockingAlert:1'),
      ).toBeInTheDocument();
    });

    // Should display the uncounted item in the table
    await waitFor(() => {
      expect(screen.getByText('SKU-UNCOUNTED')).toBeInTheDocument();
      expect(screen.getByText('A3.1')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', {
      name: /review\.commitAdjustments/i,
    });
    expect(submitBtn).toBeDisabled();
  });

  it('submits reconciliation with custom reason when all lines are counted', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
    const mockOnClose = jest.fn();

    render(
      <StocktakeReviewModal
        isOpen={true}
        onClose={mockOnClose}
        stocktakeId="stk-123"
        locationCode="WH-MAIN"
        canWrite={true}
        onSubmitReconciliation={mockOnSubmit}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', {
      name: /review\.commitAdjustments/i,
    });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.stringContaining('Physical Stocktake WH-MAIN'),
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('triggers onReopen and closes modal when reopen button is clicked in review footer', async () => {
    const user = userEvent.setup();
    const mockOnReopen = jest.fn().mockResolvedValue(undefined);
    const mockOnClose = jest.fn();

    render(
      <StocktakeReviewModal
        isOpen={true}
        onClose={mockOnClose}
        stocktakeId="stk-123"
        locationCode="WH-MAIN"
        canWrite={true}
        onSubmitReconciliation={jest.fn()}
        onReopen={mockOnReopen}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'reopen' })).toBeInTheDocument();
    });

    const reopenBtn = screen.getByRole('button', { name: 'reopen' });
    await user.click(reopenBtn);

    await waitFor(() => {
      expect(mockOnReopen).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
