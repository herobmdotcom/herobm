import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateProductSlideOver from '../CreateProductSlideOver';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  productsControllerCreate: jest.fn(),
  productsControllerAddSupplier: jest.fn(),
  uomDictionaryControllerFindAll: jest.fn().mockResolvedValue({
    data: [
      { uomCode: 'EA', description: 'Each', category: 'goods' },
      { uomCode: 'BOX', description: 'Box of 10', category: 'goods' },
      { uomCode: 'HR', description: 'Hour', category: 'service' },
    ],
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'createSlideOver.title': 'Add Product to Catalogue',
        'createSlideOver.subtitle': 'Create a new product in the catalogue',
        'createSlideOver.supplierLinkNote': `Will automatically link to supplier: ${params?.vendorName || ''}`,
        'createSlideOver.success': 'Product created successfully',
        'createSlideOver.standardCost': 'Standard Cost',
        'createSlideOver.listPrice': 'List Price',
        'createSlideOver.submit': 'New Product',
        'buttons.addProduct': 'Add Product',
        'cards.identity': 'Identity',
        'cards.classification': 'Classification',
        'cards.pricing': 'Pricing',
        'columns.productNumber': 'Product # (SKU)',
        'productName': 'Product Name',
        'baseUom': 'Base UoM',
        'columns.type': 'Type',
        'structureType': 'Structure',
        'columns.status': 'Status',
        'productGroup': 'Product Group',
        'columns.barcode': 'Barcode',
        'types.inventory': 'Stock Goods',
        'types.nonStock': 'Non-Stock Goods',
        'types.service': 'Service',
        'types.freight': 'Freight',
        'structures.standard': 'Standard',
        'structures.kit': 'Kit',
        'placeholders.productNumber': 'e.g. SKU-1001',
        'placeholders.productName': 'e.g. Industrial Bolt M8',
        'placeholders.barcode': 'Barcode',
        'cancel': 'Cancel',
        'saved': 'Saved',
        'saving': 'Saving...',
        'selectOption': 'Select...',
        'states.active': 'Active',
        'states.inactive': 'Inactive',
        'states.discontinued': 'Discontinued',
      };
      if (translations[key]) return translations[key];
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

jest.mock('@/components/shared/GroupSelect', () => {
  return function MockGroupSelect({
    value,
    onChange,
  }: {
    value?: string | null;
    onChange: (val: string | null) => void;
  }) {
    return (
      <select
        data-testid="mock-group-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">None</option>
        <option value="group-1">Group 1</option>
      </select>
    );
  };
});

describe('CreateProductSlideOver', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    vendorId: 'vendor-123',
    vendorName: 'Acme Supplies',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerCreate as jest.Mock).mockResolvedValue({
      data: {
        productId: 'prod-999',
        productNumber: 'SKU-001',
        name: 'Test Product',
        baseUom: 'EA',
      },
    });
    (api.productsControllerAddSupplier as jest.Mock).mockResolvedValue({});
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CreateProductSlideOver {...defaultProps} isOpen={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders form inputs and loads UOM dictionary when open', async () => {
    render(<CreateProductSlideOver {...defaultProps} />);

    expect(screen.getByText('Add Product to Catalogue')).toBeInTheDocument();
    expect(
      screen.getByText('Will automatically link to supplier: Acme Supplies'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(api.uomDictionaryControllerFindAll).toHaveBeenCalled();
    });

    expect(screen.getByLabelText(/Product # \(SKU\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Product Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Base UoM/i)).toBeInTheDocument();
  });

  it('keeps submit button disabled when required fields are empty', async () => {
    render(<CreateProductSlideOver {...defaultProps} />);
    await waitFor(() => {
      expect(api.uomDictionaryControllerFindAll).toHaveBeenCalled();
    });

    const submitButtons = screen.getAllByRole('button', { name: 'New Product' });
    const submitBtn = submitButtons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDisabled();
  });

  it('submits successfully and links supplier if vendorId provided', async () => {
    const user = userEvent.setup();
    render(<CreateProductSlideOver {...defaultProps} />);

    await waitFor(() => {
      expect(api.uomDictionaryControllerFindAll).toHaveBeenCalled();
    });

    const skuInput = screen.getByLabelText(/Product # \(SKU\)/i);
    const nameInput = screen.getByLabelText(/Product Name/i);
    const costInput = screen.getByLabelText(/Standard Cost/i);

    await user.type(skuInput, 'PROD-NEW-01');
    await user.type(nameInput, 'Brand New Item');
    await user.type(costInput, '25.50');

    const submitButtons = screen.getAllByRole('button', { name: 'New Product' });
    const submitBtn = submitButtons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn!);

    await waitFor(() => {
      expect(api.productsControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          productNumber: 'PROD-NEW-01',
          name: 'Brand New Item',
          baseUom: 'EA',
          standardCost: '25.5',
        }),
      );
    });

    expect(api.productsControllerAddSupplier).toHaveBeenCalledWith(
      'prod-999',
      expect.objectContaining({
        vendorId: 'vendor-123',
        costPrice: 25.5,
        isPreferred: true,
      }),
    );

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod-999' }),
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles cancel button click', async () => {
    const user = userEvent.setup();
    render(<CreateProductSlideOver {...defaultProps} />);
    await waitFor(() => {
      expect(api.uomDictionaryControllerFindAll).toHaveBeenCalled();
    });

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
