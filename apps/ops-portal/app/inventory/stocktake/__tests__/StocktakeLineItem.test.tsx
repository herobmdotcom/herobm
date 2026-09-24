import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StocktakeLineItem from '../components/StocktakeLineItem';
import { StocktakeItem } from '../types';

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

describe('StocktakeLineItem Component', () => {
  const baseItem: StocktakeItem = {
    id: 'bin-1_prod-1',
    productId: 'prod-1',
    productNumber: 'SKU-001',
    productName: 'Precision Widget',
    barcode: '123456789012',
    binId: 'bin-1',
    binNumber: 'A-01-01',
    locationId: 'loc-1',
    locationCode: 'WH-MAIN',
    expectedQuantity: 10,
    countedQuantity: null,
    baseUom: 'PCS',
    isUnlisted: false,
  };

  const onSelect = jest.fn();
  const onUpdateCount = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders product details when countedQuantity is null', () => {
    render(
      <StocktakeLineItem
        item={baseItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('Precision Widget')).toBeInTheDocument();
    expect(screen.getByText('123456789012')).toBeInTheDocument();
    expect(screen.getByText('10 PCS')).toBeInTheDocument();
  });

  it('hides expected quantity when isBlindCount is true', () => {
    render(
      <StocktakeLineItem
        item={baseItem}
        isSelected={false}
        isBlindCount={true}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.queryByText('10 PCS')).not.toBeInTheDocument();
  });

  it('displays match status tick circle when counted quantity equals expected quantity', () => {
    const countedItem: StocktakeItem = {
      ...baseItem,
      countedQuantity: 10,
    };

    render(
      <StocktakeLineItem
        item={countedItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByLabelText('status.match')).toBeInTheDocument();
    expect(screen.getByText('check')).toBeInTheDocument();
  });

  it('displays surplus status badge with +N when counted quantity exceeds expected quantity', () => {
    const surplusItem: StocktakeItem = {
      ...baseItem,
      countedQuantity: 15,
    };

    render(
      <StocktakeLineItem
        item={surplusItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('displays shortage status badge with -N when counted quantity is less than expected quantity', () => {
    const shortageItem: StocktakeItem = {
      ...baseItem,
      countedQuantity: 8,
    };

    render(
      <StocktakeLineItem
        item={shortageItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('calls onSelect when clicking anywhere on the item card including the bottom half', async () => {
    const user = userEvent.setup();

    render(
      <StocktakeLineItem
        item={baseItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    // Click expected quantity in the lower half
    const expectedVal = screen.getByText('10 PCS');
    await user.click(expectedVal);

    expect(onSelect).toHaveBeenCalledWith('bin-1_prod-1');

    // Click counted button
    const countedBtn = screen.getByTitle('clickToEditQty');
    await user.click(countedBtn);

    expect(onSelect).toHaveBeenCalledWith('bin-1_prod-1');
  });

  it('renders product image when imagePath is provided', () => {
    const itemWithImage: StocktakeItem = {
      ...baseItem,
      imagePath: 'sample-image.jpg',
    };

    render(
      <StocktakeLineItem
        item={itemWithImage}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    const img = screen.getByAltText('Precision Widget');
    expect(img).toBeInTheDocument();
  });

  it('renders description when description is provided', () => {
    const itemWithDesc: StocktakeItem = {
      ...baseItem,
      description: 'High-grade stainless steel component',
    };

    render(
      <StocktakeLineItem
        item={itemWithDesc}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByText('High-grade stainless steel component')).toBeInTheDocument();
  });

  it('allows entering custom quantity through the custom count input form', async () => {
    const user = userEvent.setup();

    render(
      <StocktakeLineItem
        item={baseItem}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    // Click the quantity display / edit trigger
    const countDisplayBtn = screen.getByTitle('clickToEditQty');
    await user.click(countDisplayBtn);

    const input = screen.getByPlaceholderText('0');
    expect(input).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '42');

    const saveBtn = screen.getByRole('button', { name: 'save' });
    await user.click(saveBtn);

    expect(onUpdateCount).toHaveBeenCalledWith('bin-1_prod-1', 42);
  });

  it('renders notes preview when item has notes', () => {
    const itemWithNotes: StocktakeItem = {
      ...baseItem,
      notes: 'Found in rear of shelf',
    };

    render(
      <StocktakeLineItem
        item={itemWithNotes}
        isSelected={false}
        isBlindCount={false}
        onSelect={onSelect}
        onUpdateCount={onUpdateCount}
      />
    );

    expect(screen.getByText('Found in rear of shelf')).toBeInTheDocument();
  });
});
