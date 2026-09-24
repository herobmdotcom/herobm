import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSuppliersTab } from '../ProductSuppliersTab';
import * as api from '@herobm/sdk';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@herobm/sdk', () => ({
  suppliersControllerFindByProduct: jest.fn(),
  productsControllerRemoveSupplier: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/components/products/AddSupplierModal', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-add-supplier-modal" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key}:${params.name}`;
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

describe('ProductSuppliersTab Component', () => {
  const mockProductId = 'prod-123';
  const mockProductName = 'Industrial Sensor';
  const mockProductNumber = 'SENS-001';

  const mockSuppliers = [
    {
      productSupplierId: 'ps-1',
      productId: mockProductId,
      vendorId: 'vend-1',
      vendorName: 'Acme Components',
      vendorNumber: 'SUP-001',
      supplierPartNumber: 'ACM-SENS-99',
      costPrice: '45.00',
      discountPercent: '5.00',
      stateCode: 'active',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: mockSuppliers,
    });
  });

  it('renders linked suppliers using horizontal cards', async () => {
    render(
      <ProductSuppliersTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Components')).toBeInTheDocument();
      expect(screen.getByText(/SUP-001/)).toBeInTheDocument();
      expect(screen.getByText(/ACM-SENS-99/)).toBeInTheDocument();
      expect(screen.getByText('$45.00')).toBeInTheDocument();
    });
  });

  it('shows empty state when no suppliers are linked', async () => {
    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(
      <ProductSuppliersTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('common.noMatchingResults')).toBeInTheDocument();
    });
  });

  it('allows unlinking a supplier', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    (api.productsControllerRemoveSupplier as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    render(
      <ProductSuppliersTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Components')).toBeInTheDocument();
    });

    const unlinkBtn = screen.getByTitle('suppliers.buttons.unlinkSupplier');
    await user.click(unlinkBtn);

    await waitFor(() => {
      expect(api.productsControllerRemoveSupplier).toHaveBeenCalledWith(
        mockProductId,
        'vend-1'
      );
    });
  });

  it('navigates to new PO page when Create PO header button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ProductSuppliersTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    const createPoBtn = screen.getByRole('button', { name: 'purchaseOrders.buttons.createPO' });
    await user.click(createPoBtn);

    expect(mockPush).toHaveBeenCalledWith(`/purchase-orders/new?productId=${mockProductId}`);
  });

  it('navigates to new PO page with vendorId and productId when card Create PO icon button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ProductSuppliersTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Components')).toBeInTheDocument();
    });

    const cardCreatePoBtn = screen.getByTitle('purchaseOrders.buttons.createPO');
    await user.click(cardCreatePoBtn);

    expect(mockPush).toHaveBeenCalledWith(
      `/purchase-orders/new?vendorId=vend-1&productId=${mockProductId}`
    );
  });
});
