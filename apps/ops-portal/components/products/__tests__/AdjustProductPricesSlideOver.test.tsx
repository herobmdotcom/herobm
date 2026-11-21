import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '@herobm/sdk';
import AdjustProductPricesSlideOver from '../AdjustProductPricesSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return `${key}:${JSON.stringify(params)}`;
  },
}));

jest.mock('react-hot-toast', () => {
  const toast = Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  });
  return { toast };
});

jest.mock('@herobm/sdk', () => ({
  productsControllerFindOne: jest.fn(),
  productsControllerUpdate: jest.fn(),
}));

describe('AdjustProductPricesSlideOver', () => {
  const mockProduct = {
    productId: 'prod-1',
    productNumber: 'SKU-100',
    name: 'Copper Pipe',
    baseUom: 'EA',
    defaultPurchaseUomId: 'uom-box',
    standardCost: '10.00',
    weightedAverageCost: '9.80',
    listPrice: '20.00',
    tradePrice: '16.00',
    priceLevel3: '15.00',
    priceLevel4: '14.00',
    productUoms: [
      {
        productUomId: 'uom-box',
        uomCode: 'BOX',
        ratio: '12',
        isPurchaseDefault: true,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerFindOne as jest.Mock).mockResolvedValue({
      data: mockProduct,
    });
    (api.productsControllerUpdate as jest.Mock).mockResolvedValue({
      data: mockProduct,
    });
  });

  it('loads product prices, converts purchase UOM cost to base unit cost, maintains margin, and saves', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onSaved = jest.fn();

    render(
      <AdjustProductPricesSlideOver
        isOpen={true}
        onClose={onClose}
        productId="prod-1"
        invoiceUnitCost={144}
        currencyCode="AUD"
        onSaved={onSaved}
      />,
    );

    // Wait for product to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('20.00')).toBeInTheDocument();
    });

    // Purchase default UOM (BOX x12) is auto-selected: 144 / 12 = 12.00 (+20.0% over 10.00)
    expect(screen.getByText('+20.0%')).toBeInTheDocument();

    // Click "Use Invoice Cost" -> standardCost becomes 12.00
    await user.click(screen.getByRole('button', { name: 'useInvoiceCost' }));
    expect(screen.getByLabelText('standardCost')).toHaveValue(12);

    // Click "Maintain Margin %" -> listPrice 20 -> 24, tradePrice 16 -> 19.20, L3 15 -> 18, L4 14 -> 16.80
    await user.click(screen.getByRole('button', { name: 'maintainMargin' }));
    expect(screen.getByLabelText('listPrice')).toHaveValue(24);
    expect(screen.getByLabelText('tradePrice')).toHaveValue(19.2);
    expect(screen.getByLabelText('priceLevel3')).toHaveValue(18);
    expect(screen.getByLabelText('priceLevel4')).toHaveValue(16.8);

    // Save
    await user.click(screen.getByRole('button', { name: 'saveButton' }));

    await waitFor(() => {
      expect(api.productsControllerUpdate).toHaveBeenCalledWith('prod-1', {
        standardCost: '12.00',
        listPrice: '24.00',
        tradePrice: '19.20',
        priceLevel3: '18.00',
        priceLevel4: '16.80',
      });
    });

    expect(onSaved).toHaveBeenCalledWith({
      productId: 'prod-1',
      standardCost: '12.00',
      listPrice: '24.00',
      tradePrice: '19.20',
      priceLevel3: '18.00',
      priceLevel4: '16.80',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('rounds current sell prices when clicking a rounding button', async () => {
    const user = userEvent.setup();

    render(
      <AdjustProductPricesSlideOver
        isOpen={true}
        onClose={jest.fn()}
        productId="prod-1"
        invoiceUnitCost={144}
        currencyCode="AUD"
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('20.00')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'maintainMargin' }));
    await user.click(screen.getByRole('button', { name: 'rounding.end95' }));

    // 24.00 -> 23.95, 19.20 -> 18.95
    expect(screen.getByLabelText('listPrice')).toHaveValue(23.95);
    expect(screen.getByLabelText('tradePrice')).toHaveValue(18.95);
  });
});
