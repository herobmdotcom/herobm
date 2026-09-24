import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddSupplierModal from '../AddSupplierModal';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  productsControllerAddSupplier: jest.fn(),
  suppliersControllerFindAll: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (key === 'title') return 'Link Supplier';
      if (key === 'editTitle') return 'Edit Supplier Link';
      if (key === 'inputs.searchSupplier') return 'Search & Select Supplier';
      if (key === 'inputs.supplierPartNo') return 'Supplier Part No.';
      if (key === 'inputs.costPrice') return 'Cost Price';
      if (key === 'inputs.discountPercent') return 'Discount %';
      if (key === 'inputs.minPurchaseQty') return 'Min. Purchase Qty (MOQ)';
      if (key === 'inputs.purchaseUnit') return 'Purchase Unit';
      if (key === 'inputs.isPreferred') return 'Preferred Supplier';
      if (key === 'buttons.cancel') return 'Cancel';
      if (key === 'buttons.linkProduct') return 'Link Product';
      if (key === 'buttons.saveChanges') return 'Save Changes';
      if (key === 'messages.success') return 'Supplier successfully linked';
      if (key === 'messages.updateSuccess') return 'Supplier link updated successfully';
      if (key === 'messages.selectDropdown') return 'Please select a supplier from the dropdown';
      return `${namespace ? `${namespace}.` : ''}${key}`;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock SupplierSelect component
jest.mock('@/components/shared/SupplierSelect', () => {
  return function MockSupplierSelect({
    value,
    onChange,
  }: {
    value?: string | null;
    onChange: (supplier: { vendorId: string; name: string; vendorNumber: string } | null) => void;
  }) {
    return (
      <div data-testid="mock-supplier-select">
        <input
          data-testid="supplier-select-input"
          value={value || ''}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { vendorId: e.target.value, name: 'Acme Corp', vendorNumber: 'SUP-001' }
                : null
            )
          }
        />
      </div>
    );
  };
});

describe('AddSupplierModal Component', () => {
  const mockProductId = 'prod-123';
  const mockProductName = 'Industrial Sensor';
  const mockProductNumber = 'SENS-001';
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders standard slide-over title, product subtitle, and form fields when isOpen is true', () => {
    render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Link Supplier')).toBeInTheDocument();
    expect(screen.getByText(`${mockProductNumber} · ${mockProductName}`)).toBeInTheDocument();
    expect(screen.getByText(/Search & Select Supplier/)).toBeInTheDocument();
    expect(screen.getByText('Supplier Part No.')).toBeInTheDocument();
    expect(screen.getByText('Cost Price')).toBeInTheDocument();
    expect(screen.getByText('Min. Purchase Qty (MOQ)')).toBeInTheDocument();
    expect(screen.getByText('Purchase Unit')).toBeInTheDocument();
    expect(screen.getByText('Preferred Supplier')).toBeInTheDocument();
    expect(screen.getByTestId('mock-supplier-select')).toBeInTheDocument();
  });

  it('disables submit button when no supplier is selected', () => {
    render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: 'Link Product' });
    expect(submitBtn).toBeDisabled();
  });

  it('submits successfully when supplier is selected and details are filled', async () => {
    const user = userEvent.setup();
    (api.productsControllerAddSupplier as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Select supplier via mock input
    const supplierInput = screen.getByTestId('supplier-select-input');
    await user.type(supplierInput, 'vend-123');

    // Fill supplier part number
    const partNoInput = screen.getByLabelText('Supplier Part No.');
    await user.type(partNoInput, 'PART-999');

    // Fill cost price
    const costPriceInput = screen.getByLabelText('Cost Price');
    await user.clear(costPriceInput);
    await user.type(costPriceInput, '24.50');

    // Fill MOQ & Purchase Unit & Preferred
    const moqInput = screen.getByLabelText('Min. Purchase Qty (MOQ)');
    await user.type(moqInput, '10');

    const unitInput = screen.getByLabelText('Purchase Unit');
    await user.type(unitInput, 'BOX');

    const preferredInput = screen.getByLabelText('Preferred Supplier');
    await user.click(preferredInput);

    // Submit button should now be enabled
    const submitBtn = screen.getByRole('button', { name: 'Link Product' });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(api.productsControllerAddSupplier).toHaveBeenCalledWith(mockProductId, {
        vendorId: 'vend-123',
        supplierPartNumber: 'PART-999',
        costPrice: 24.5,
        discountPercent: undefined,
        minPurchaseQty: 10,
        purchaseUnit: 'BOX',
        isPreferred: true,
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('pre-populates fields and submits updates when initialData is provided for editing', async () => {
    const user = userEvent.setup();
    (api.productsControllerAddSupplier as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    const initialData = {
      vendorId: 'vend-456',
      vendorName: 'Apex Tools',
      vendorNumber: 'VEND-002',
      supplierPartNumber: 'OLD-PART-1',
      costPrice: '15.50',
      discountPercent: '5',
      minPurchaseQty: '25',
      purchaseUnit: 'PACK',
      isPreferred: true,
    };

    render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        initialData={initialData}
      />
    );

    expect(screen.getByText('Edit Supplier Link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();

    const partNoInput = screen.getByLabelText('Supplier Part No.');
    expect(partNoInput).toHaveValue('OLD-PART-1');
    const costPriceInput = screen.getByLabelText('Cost Price');
    expect(costPriceInput).toHaveValue(15.5);
    const discountInput = screen.getByLabelText('Discount %');
    expect(discountInput).toHaveValue(5);
    const moqInput = screen.getByLabelText('Min. Purchase Qty (MOQ)');
    expect(moqInput).toHaveValue(25);
    const unitInput = screen.getByLabelText('Purchase Unit');
    expect(unitInput).toHaveValue('PACK');
    const preferredInput = screen.getByLabelText('Preferred Supplier');
    expect(preferredInput).toBeChecked();

    // Modify cost price and MOQ
    await user.clear(costPriceInput);
    await user.type(costPriceInput, '18.00');

    await user.clear(moqInput);
    await user.type(moqInput, '50');

    const submitBtn = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(api.productsControllerAddSupplier).toHaveBeenCalledWith(mockProductId, {
        vendorId: 'vend-456',
        supplierPartNumber: 'OLD-PART-1',
        costPrice: 18,
        discountPercent: 5,
        minPurchaseQty: 50,
        purchaseUnit: 'PACK',
        isPreferred: true,
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AddSupplierModal
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
