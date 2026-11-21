import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplierInvoiceLinesTab from '../SupplierInvoiceLinesTab';
import { PURCHASE_INVOICE_STATE } from '@herobm/shared';

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
            props.onSuccess({ productId: 'prod-inv-1', name: 'Invoice Product' })
          }
        >
          Mock Submit Invoice Product
        </button>
        <button onClick={props.onClose}>Mock Close</button>
      </div>
    );
  };
});

jest.mock('@/components/shared/POMatchingPanel', () => () => <div data-testid="mock-po-matching-panel" />);
jest.mock('@/components/shared/ProductSearchInput', () => () => <input data-testid="mock-product-search" />);
jest.mock('@/components/shared/ProductQuickAddBar', () => {
  return function MockProductQuickAddBar(props: {
    onAdd: (p: { productId: string; name: string; standardCost?: string }, qty: string) => void;
  }) {
    return (
      <div data-testid="mock-quick-add-bar">
        <button
          onClick={() =>
            props.onAdd(
              { productId: 'prod-qa-1', name: 'Quick Add Item', standardCost: '10.00' },
              '5',
            )
          }
        >
          Mock Quick Add
        </button>
      </div>
    );
  };
});
jest.mock('@/components/products/AdjustProductPricesSlideOver', () => {
  return function MockAdjustProductPricesSlideOver(props: {
    isOpen: boolean;
    productId: string | null;
    invoiceUnitCost: number;
    onClose: () => void;
  }) {
    if (!props.isOpen) return null;
    return (
      <div data-testid="mock-adjust-prices-slideover">
        <span>{`${props.productId}:${props.invoiceUnitCost}`}</span>
        <button onClick={props.onClose}>Close Adjust</button>
      </div>
    );
  };
});
jest.mock('@/components/shared/MobileLineItemCard', () => () => <div data-testid="mock-mobile-card" />);

describe('SupplierInvoiceLinesTab', () => {
  const defaultProps = {
    invoice: {
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-001',
      stateCode: PURCHASE_INVOICE_STATE.DRAFT,
      vendorId: 'vendor-1',
      vendorName: 'Acme Parts',
      lines: [],
    } as never,
    isMatchingMode: false,
    setIsMatchingMode: jest.fn(),
    selectedInvoiceLineId: null,
    setSelectedInvoiceLineId: jest.fn(),
    showDiscrepancyModal: false,
    setShowDiscrepancyModal: jest.fn(),
    discrepancies: [],
    setDiscrepanciesAcknowledged: jest.fn(),
    pendingState: null,
    changeState: jest.fn(),
    matchingPanelLines: [],
    handlePanelMatch: jest.fn(),
    handleAutoMatch: jest.fn(),
    updateLine: jest.fn(),
    removeLine: jest.fn(),
    addBlankLine: jest.fn(),
    addRoundingLine: jest.fn(),
    addProductLine: jest.fn(),
    handleProductSelect: jest.fn(),
    handleUnresolve: jest.fn(),
    editTaxAmount: '0.00',
    setEditTaxAmount: jest.fn(),
    saveHeader: jest.fn(),
    saving: false,
    glAccounts: [],
    t: (key: string) => {
      const map: Record<string, string> = {
        'matching.panelTitle': 'PO Matching',
        addLine: 'Add Line',
        addRoundingAdj: 'Add Rounding Adj',
        'supplierInvoice.addProduct': 'New Product',
        'supplierInvoice.adjustPrices': 'Adjust Retail Prices',
        'supplierInvoice.costIncreasedHint': 'Cost increased',
      };
      return map[key] || key;
    },
    tCommon: (key: string) => key,
  };

  it('renders the "New Product" button when editable and not in matching mode', () => {
    render(<SupplierInvoiceLinesTab {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: 'New Product' }),
    ).toBeInTheDocument();
  });

  it('opens the CreateProductSlideOver and calls addProductLine on success', async () => {
    const user = userEvent.setup();
    render(<SupplierInvoiceLinesTab {...defaultProps} />);

    expect(
      screen.queryByTestId('mock-create-product-slideover'),
    ).not.toBeInTheDocument();

    const addProductBtn = screen.getByRole('button', { name: 'New Product' });
    await user.click(addProductBtn);

    expect(
      screen.getByTestId('mock-create-product-slideover'),
    ).toBeInTheDocument();

    const submitProductBtn = screen.getByText('Mock Submit Invoice Product');
    await user.click(submitProductBtn);

    expect(defaultProps.addProductLine).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-inv-1',
        name: 'Invoice Product',
      }),
    );
  });

  it('renders ProductQuickAddBar and passes product and quantity to addProductLine', async () => {
    const user = userEvent.setup();
    render(<SupplierInvoiceLinesTab {...defaultProps} />);

    expect(screen.getByTestId('mock-quick-add-bar')).toBeInTheDocument();
    await user.click(screen.getByText('Mock Quick Add'));

    expect(defaultProps.addProductLine).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-qa-1',
        name: 'Quick Add Item',
      }),
      '5',
    );
  });

  it('opens AdjustProductPricesSlideOver when clicking the per-line adjust prices button', async () => {
    const user = userEvent.setup();
    const invoiceWithLine = {
      ...(defaultProps.invoice as Record<string, unknown>),
      totalAmount: '50.00',
      taxAmount: '0.00',
      currencyCode: 'AUD',
      lines: [
        {
          lineId: 'line-1',
          productId: 'prod-123',
          productNumber: 'SKU-123',
          description: 'Widget',
          matchStatus: 'UNMATCHED',
          quantityInvoiced: '2',
          pricePerUnit: '25.00',
          amount: '50.00',
        },
      ],
    } as never;

    render(
      <SupplierInvoiceLinesTab
        {...defaultProps}
        invoice={invoiceWithLine}
        canEditProducts={true}
      />,
    );

    const adjustBtn = screen.getByRole('button', { name: 'Adjust Retail Prices' });
    await user.click(adjustBtn);

    expect(screen.getByTestId('mock-adjust-prices-slideover')).toBeInTheDocument();
    expect(screen.getByText('prod-123:25')).toBeInTheDocument();
  });

  it('hides the per-line adjust prices button when canEditProducts is false', () => {
    const invoiceWithLine = {
      ...(defaultProps.invoice as Record<string, unknown>),
      totalAmount: '50.00',
      taxAmount: '0.00',
      currencyCode: 'AUD',
      lines: [
        {
          lineId: 'line-1',
          productId: 'prod-123',
          productNumber: 'SKU-123',
          description: 'Widget',
          matchStatus: 'UNMATCHED',
          quantityInvoiced: '2',
          pricePerUnit: '25.00',
          amount: '50.00',
        },
      ],
    } as never;

    render(
      <SupplierInvoiceLinesTab
        {...defaultProps}
        invoice={invoiceWithLine}
        canEditProducts={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Adjust Retail Prices' }),
    ).not.toBeInTheDocument();
  });
});
