import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestockGeneratePOsSlideOver, { RestockItemWithQty } from '../RestockGeneratePOsSlideOver';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  allocationsControllerGeneratePOs: jest.fn().mockResolvedValue({ data: { success: true } }),
  suppliersControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (key === 'generatePOsTitle') return 'Generate Purchase Orders';
  if (key === 'btnGeneratePOs' || key === 'generatePOs') return 'Create Purchase Orders';
  if (key === 'cancel') return 'Cancel';
  if (key === 'colProduct') return 'Product';
  if (key === 'colBin') return 'Bin';
  if (key === 'colOnHand') return 'On Hand';
  if (key === 'colOnOrder') return 'On Order';
  if (key === 'colMinQty') return 'Min';
  if (key === 'colMaxQty') return 'Max';
  if (key === 'colRestockQty') return 'Order Qty';
  if (key === 'colUnitCost') return 'Unit Cost';
  if (key === 'colLineTotal') return 'Total';
  if (key === 'unassigned') return 'Unassigned Supplier';
  if (key === 'posGeneratedSuccess') return `Generated ${params?.count || 1} PO(s)`;
  return key;
};
(mockT as any).has = () => true;

jest.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

jest.mock('react-hot-toast', () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/components/shared/SlideOver', () => {
  return function MockSlideOver({ children, isOpen, title, subtitle, footer }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="mock-slide-over">
        <div>{title}</div>
        <div>{subtitle}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    );
  };
});

jest.mock('@/components/shared/SupplierSelect', () => {
  return function MockSupplierSelect() {
    return <div data-testid="mock-supplier-select" />;
  };
});

describe('RestockGeneratePOsSlideOver Component', () => {
  const mockItems: RestockItemWithQty[] = [
    {
      id: 'restock-item-1',
      productId: 'prod-101',
      productNumber: 'P-101',
      productName: 'Hydraulic Hose M10',
      productType: 'inventory',
      baseUom: 'EA',
      locationId: 'loc-1',
      locationName: 'Main Warehouse',
      locationCode: 'MAIN',
      binId: 'bin-1',
      binNumber: 'A-01-01',
      binType: 'pick',
      quantityOnHand: 4,
      quantityCommitted: 0,
      quantityOnOrder: 0,
      availableQuantity: 4,
      minQuantity: 20,
      maxQuantity: 50,
      suggestedRestockQty: 15,
      restockQty: 15,
      vendorId: 'vend-1',
      vendorName: 'Continental Hydraulics',
      costPrice: 25.0,
      currencyCode: 'USD',
      minPurchaseQty: 10,
      purchaseUnit: 'BOX',
      purchaseUomId: 'uom-box-1',
      purchaseUomCode: 'BOX',
      purchaseUomRatio: 10,
    },
  ];

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pack size badge and MOQ indicator', () => {
    render(
      <RestockGeneratePOsSlideOver
        isOpen={true}
        onClose={mockOnClose}
        items={mockItems}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('P-101')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic Hose M10')).toBeInTheDocument();
    expect(screen.getByText('MOQ: 10')).toBeInTheDocument();
    expect(screen.getByText('Pack: BOX (x10)')).toBeInTheDocument();
  });

  it('flags warning when quantity is not a multiple of pack ratio and clears on multiple', async () => {
    const user = userEvent.setup();

    render(
      <RestockGeneratePOsSlideOver
        isOpen={true}
        onClose={mockOnClose}
        items={mockItems}
        onSuccess={mockOnSuccess}
      />
    );

    const [qtyInput] = screen.getAllByRole('spinbutton');
    expect(qtyInput).toHaveValue(15);
    // 15 % 10 !== 0 -> border-amber-500
    expect(qtyInput.className).toContain('border-amber-500');

    // Change qty to 20 (valid multiple of 10)
    await user.clear(qtyInput);
    await user.type(qtyInput, '20');

    expect(qtyInput).toHaveValue(20);
    expect(qtyInput.className).not.toContain('border-amber-500');
  });

  it('submits PO generation payload when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RestockGeneratePOsSlideOver
        isOpen={true}
        onClose={mockOnClose}
        items={mockItems}
        onSuccess={mockOnSuccess}
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Create Purchase Orders/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(api.allocationsControllerGeneratePOs).toHaveBeenCalledWith({
        pos: [
          {
            vendorId: 'vend-1',
            deliveryLocationId: 'loc-1',
            currencyCode: 'USD',
            soNumbers: ['Restock'],
            lines: [
              {
                productId: 'prod-101',
                quantity: '15',
                pricePerUnit: '25',
              },
            ],
          },
        ],
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
