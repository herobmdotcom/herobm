import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuantityCell } from '../cells/QuantityCell';
import type { OrderLineItem } from '../types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('QuantityCell Component', () => {
  const baseLine: OrderLineItem = {
    id: 'line-1',
    productId: 'prod-1',
    productNumber: 'P-001',
    productDescription: 'Hex Bolt M8',
    quantity: 15,
    unitOfMeasure: 'EA',
    pricePerUnit: 2.5,
    minPurchaseQty: 10,
    purchaseUnit: 'BOX',
    purchaseUomId: 'uom-box-1',
    purchaseUomCode: 'BOX',
    purchaseUomRatio: 10,
  };

  it('renders pack badge and warning for non-multiple quantities in editable mode', () => {
    render(
      <QuantityCell
        line={baseLine}
        lineIdentifier="line-1"
        isEditable={true}
      />
    );

    expect(screen.getByText('Pack: BOX (x10)')).toBeInTheDocument();
    expect(screen.getByText('MOQ: 10')).toBeInTheDocument();

    const input = screen.getByRole('spinbutton');
    expect(input.className).toContain('border-amber-400');
  });

  it('renders without warning border when quantity is a multiple of pack ratio', () => {
    const validLine: OrderLineItem = {
      ...baseLine,
      quantity: 20,
    };

    render(
      <QuantityCell
        line={validLine}
        lineIdentifier="line-1"
        isEditable={true}
      />
    );

    expect(screen.getByText('Pack: BOX (x10)')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton');
    expect(input.className).not.toContain('border-amber-400');
  });

  it('renders pack badge in read-only mode', () => {
    render(
      <QuantityCell
        line={baseLine}
        lineIdentifier="line-1"
        isEditable={false}
      />
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Pack: BOX (x10)')).toBeInTheDocument();
  });
});
