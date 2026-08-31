import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderLinesTable } from '../OrderLinesTable';
import { CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import type { OrderLineItem, TaxCategory } from '../types';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const messages: Record<string, string> = {
      'salesOrders.noLineItems': 'No line items in order.',
      'salesOrders.columns.lineNumber': '#',
      'salesOrders.columns.product': 'Product',
      'salesOrders.columns.description': 'Description',
      'salesOrders.columns.qty': 'Qty',
      'salesOrders.columns.uom': 'UoM',
      'salesOrders.columns.unitPrice': 'Unit Price',
      'salesOrders.columns.discountPct': 'Disc %',
      'salesOrders.columns.tax': 'Tax',
      'salesOrders.columns.amount': 'Amount',
      'salesOrders.columns.postConfirmation': 'Post-Conf',
      'salesOrders.buttons.removeLine': 'Remove',
      'salesOrders.availabilityStatus.shortage': 'Stock shortage',
      'salesOrders.availabilityStatus.backordered': 'Backordered',
      'purchaseOrders.columns.received': 'Received',
      'common.subtotal': 'Subtotal',
      'common.tax': 'Tax',
      'common.total': 'Total',
      'common.auto': 'Auto',
      'common.buttons.remove': 'Remove',
    };
    return messages[fullKey] || messages[key] || key;
  },
}));

describe('OrderLinesTable Component', () => {
  const mockTaxCategories: TaxCategory[] = [
    { taxCategoryId: 'tax-1', title: 'GST Standard', rate: '10', code: 'GST', isDefault: true },
    { taxCategoryId: 'tax-2', title: 'Zero Rated', rate: '0', code: 'ZERO', isDefault: false },
  ];

  const mockLines: OrderLineItem[] = [
    {
      id: 'line-1',
      lineNumber: 1,
      lineType: LineType.PRODUCT,
      productId: 'prod-1',
      productNumber: 'P-100',
      productDescription: 'Standard Widget',
      quantity: '2',
      unitOfMeasure: 'EA',
      pricePerUnit: '50.00',
      discountPercentage: '10',
      taxCategoryId: 'tax-1',
      unitCost: '30.00',
      amount: '90.00',
      tax: '9.00',
      baseUom: 'EA',
      productUoms: [
        { uomCode: 'EA', ratio: 1 },
        { uomCode: 'BOX10', ratio: 10 },
      ],
    },
    {
      id: 'line-2',
      lineNumber: 2,
      lineType: LineType.COMMENT,
      productId: '',
      productNumber: '',
      productDescription: 'Please pack with bubble wrap',
      quantity: '0',
      pricePerUnit: '0.00',
      discountPercentage: '0',
      taxCategoryId: '',
      unitOfMeasure: 'EA',
    },
    {
      id: 'line-3',
      lineNumber: 3,
      lineType: LineType.PRODUCT,
      productId: CUSTOM_LINE_ID,
      productNumber: 'SYSTEM-CUSTOM-LINE',
      productDescription: 'Special Labor Charge',
      quantity: '1',
      unitOfMeasure: 'HR',
      pricePerUnit: '100.00',
      discountPercentage: '0',
      taxCategoryId: 'tax-1',
      amount: '100.00',
      tax: '10.00',
    },
  ];

  it('renders empty message when no lines are present', () => {
    render(
      <OrderLinesTable
        lines={[]}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
      />
    );

    expect(screen.getAllByText('No line items in order.').length).toBeGreaterThan(0);
  });

  it('renders product lines, comment lines, and custom lines correctly', () => {
    render(
      <OrderLinesTable
        lines={mockLines}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
      />
    );

    // Product link / code
    expect(screen.getAllByText('P-100').length).toBeGreaterThan(0);

    // Comment badge & Custom badge
    expect(screen.getAllByText('COMMENT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CUSTOM').length).toBeGreaterThan(0);

    // Descriptions
    expect(screen.getAllByDisplayValue('Standard Widget').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Please pack with bubble wrap').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Special Labor Charge').length).toBeGreaterThan(0);
  });

  it('renders Unit Cost column when showUnitCost is true', () => {
    render(
      <OrderLinesTable
        lines={mockLines}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        showUnitCost={true}
        isEditable={true}
      />
    );

    expect(screen.getAllByText('Unit Cost').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('30.00').length).toBeGreaterThan(0);
  });

  it('renders Received column when showReceived is true (Purchase mode)', () => {
    const poLines: OrderLineItem[] = [
      {
        ...mockLines[0],
        quantityReceived: '2',
      },
    ];

    render(
      <OrderLinesTable
        lines={poLines}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        showReceived={true}
        mode="purchase"
      />
    );

    expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('calls onUpdateLine when quantity input changes', () => {
    const handleUpdateLine = jest.fn();

    render(
      <OrderLinesTable
        lines={[mockLines[0]]}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
        onUpdateLine={handleUpdateLine}
      />
    );

    const qtyInputs = screen.getAllByDisplayValue('2');
    fireEvent.change(qtyInputs[0], { target: { value: '5' } });

    expect(handleUpdateLine).toHaveBeenCalledWith('line-1', 'quantity', '5');
  });

  it('calls onRemoveLine when delete button is clicked', () => {
    const handleRemoveLine = jest.fn();

    render(
      <OrderLinesTable
        lines={[mockLines[0]]}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
        onRemoveLine={handleRemoveLine}
      />
    );

    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[0]);

    expect(handleRemoveLine).toHaveBeenCalledWith('line-1');
  });

  it('calls onUpdateLineFields when UoM is changed with adjusted unit price', () => {
    const handleUpdateLineFields = jest.fn();

    render(
      <OrderLinesTable
        lines={[mockLines[0]]}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
        onUpdateLineFields={handleUpdateLineFields}
      />
    );

    const selectElements = screen.getAllByRole('combobox');
    const uomSelect = selectElements.find((el) =>
      Array.from((el as HTMLSelectElement).options).some((opt) => opt.value === 'BOX10')
    );

    expect(uomSelect).toBeDefined();
    if (uomSelect) {
      fireEvent.change(uomSelect, { target: { value: 'BOX10' } });
      expect(handleUpdateLineFields).toHaveBeenCalledWith('line-1', {
        unitOfMeasure: 'BOX10',
        pricePerUnit: '500.00',
      });
    }
  });

  it('renders shortage warning icon when stock shortage is detected', () => {
    const shortLine: OrderLineItem = {
      ...mockLines[0],
      quantity: '10',
      onHand: 2,
    };

    render(
      <OrderLinesTable
        lines={[shortLine]}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
      />
    );

    const warningIcons = screen.getAllByText('warning');
    expect(warningIcons.length).toBeGreaterThan(0);
  });

  it('correctly aligns footer totals under the Amount column with dynamic colSpan', () => {
    const { container } = render(
      <OrderLinesTable
        lines={mockLines}
        taxCategories={mockTaxCategories}
        currencyCode="USD"
        isEditable={true}
        onRemoveLine={jest.fn()}
      />
    );

    const desktopSubtotalRow = container.querySelector('tr.hidden.lg\\:table-row');
    expect(desktopSubtotalRow).not.toBeNull();
    const cells = desktopSubtotalRow?.querySelectorAll('td');
    expect(cells).toBeDefined();
    expect(cells?.[0]).toHaveAttribute('colspan', '8');
  });
});
