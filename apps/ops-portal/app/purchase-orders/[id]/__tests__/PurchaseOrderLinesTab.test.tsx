import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseOrderLinesTab from '../PurchaseOrderLinesTab';
import { PURCHASE_ORDER_STATE } from '@herobm/shared';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/products/CreateProductSlideOver', () => {
  return function MockCreateProductSlideOver(props: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (p: { productId: string; name: string }) => void;
  }) {
    if (!props.isOpen) return null;
    return (
      <div data-testid="mock-create-product-slideover">
        <button
          onClick={() =>
            props.onSuccess({ productId: 'prod-new-1', name: 'Created Product' })
          }
        >
          Mock Submit Product
        </button>
        <button onClick={props.onClose}>Mock Close</button>
      </div>
    );
  };
});

jest.mock('@/components/shared/OrderLinesTable', () => ({
  OrderLinesTable: () => <div data-testid="mock-order-lines-table" />,
}));

jest.mock('@/components/shared/ProductSearchInput', () => {
  return function MockProductSearchInput() {
    return <input data-testid="mock-product-search-input" />;
  };
});

describe('PurchaseOrderLinesTab', () => {
  const defaultProps = {
    order: {
      purchaseOrderId: 'po-1',
      orderNumber: 'PO-0001',
      stateCode: PURCHASE_ORDER_STATE.DRAFT,
      vendorId: 'vendor-1',
      vendorName: 'Supplier Inc',
      lines: [],
    } as never,
    inventoryData: [],
    inventoryLoading: false,
    allocations: [],
    invoices: [],
    activeTab: 'lines' as const,
    setActiveTab: jest.fn(),
    isLinesEditable: true,
    saving: false,
    updateLine: jest.fn(),
    updateLineFields: jest.fn(),
    removeLine: jest.fn(),
    addLineFromProduct: jest.fn(),
    addBlankLine: jest.fn(),
    addCommentLine: jest.fn(),
    subtotal: 0,
    totalTax: 0,
    taxCategories: [],
    tPurchase: (key: string) => {
      const map: Record<string, string> = {
        lineItems: 'Line Items',
        availability: 'Availability',
        'buttons.addProduct': 'New Product',
        'buttons.customLine': 'Add Custom Line',
        'buttons.commentLine': 'Add Comment',
      };
      return map[key] || key;
    },
    tCommon: (key: string) => key,
  };

  it('renders the "New Product" button when lines are editable', () => {
    render(<PurchaseOrderLinesTab {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: 'New Product' }),
    ).toBeInTheDocument();
  });

  it('opens the CreateProductSlideOver when clicking "New Product"', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrderLinesTab {...defaultProps} />);

    expect(
      screen.queryByTestId('mock-create-product-slideover'),
    ).not.toBeInTheDocument();

    const addProductBtn = screen.getByRole('button', { name: 'New Product' });
    await user.click(addProductBtn);

    expect(
      screen.getByTestId('mock-create-product-slideover'),
    ).toBeInTheDocument();

    const submitProductBtn = screen.getByText('Mock Submit Product');
    await user.click(submitProductBtn);

    expect(defaultProps.addLineFromProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-new-1',
        name: 'Created Product',
      }),
    );
  });
});
