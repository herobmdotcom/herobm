import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateNoteSlideOver from '../../credit-debit-notes/CreateNoteSlideOver';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  glControllerGetAccounts: jest.fn(),
  salesCreditNotesControllerCreateCreditNote: jest.fn(),
  purchaseDebitNotesControllerCreateDebitNote: jest.fn(),
  customersControllerFindAll: jest.fn(),
  suppliersControllerFindAll: jest.fn(),
}));

const mockTranslations: Record<string, string> = {
  issueCreditNote: 'Issue Credit Note',
  issueDebitNote: 'Issue Debit Note',
  issuing: 'Issuing...',
};

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => mockTranslations[key] || key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'AUD' }),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/shared/CustomerSelect', () => {
  return function MockCustomerSelect({ value, onChange }: any) {
    return (
      <div data-testid="mock-customer-select">
        <input
          data-testid="customer-select-input"
          value={value}
          onChange={(e) => onChange({ customerId: e.target.value, name: 'Test Customer' })}
        />
      </div>
    );
  };
});

jest.mock('@/components/shared/SupplierSelect', () => {
  return function MockSupplierSelect({ value, onChange }: any) {
    return (
      <div data-testid="mock-supplier-select">
        <input
          data-testid="supplier-select-input"
          value={value}
          onChange={(e) => onChange({ vendorId: e.target.value, name: 'Test Supplier' })}
        />
      </div>
    );
  };
});

describe('CreateNoteSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetAccounts as jest.Mock).mockResolvedValue({
      data: [
        { glAccountId: 'acc-1', accountCode: '4000', name: 'Sales Revenue', isActive: true, isGroup: false },
        { glAccountId: 'acc-2', accountCode: '5000', name: 'Cost of Goods', isActive: true, isGroup: false },
      ],
    });
  });

  it('renders credit note form by default and submits credit note', async () => {
    (api.salesCreditNotesControllerCreateCreditNote as jest.Mock).mockResolvedValue({ data: {} });

    render(
      <CreateNoteSlideOver
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        initialType="credit"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Credit Note (Customer)')).toBeInTheDocument();
    });

    // Select customer
    const customerInput = screen.getByTestId('customer-select-input');
    await userEvent.type(customerInput, 'cust-123');

    // Fill line description and amount
    const descInput = screen.getByPlaceholderText('Line description...');
    await userEvent.type(descInput, 'Discount Adjustment');

    const selectAccount = screen.getByRole('combobox');
    await userEvent.selectOptions(selectAccount, 'acc-1');

    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '50.00');

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Issue Credit Note' });
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.salesCreditNotesControllerCreateCreditNote).toHaveBeenCalledWith({
        customerId: 'cust-123',
        notes: undefined,
        lines: [
          {
            description: 'Discount Adjustment',
            amount: 50,
            accountId: 'acc-1',
          },
        ],
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('switches to debit note mode and submits debit note', async () => {
    (api.purchaseDebitNotesControllerCreateDebitNote as jest.Mock).mockResolvedValue({ data: {} });

    render(
      <CreateNoteSlideOver
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    // Click Debit Note toggle
    const debitToggle = screen.getByRole('tab', { name: 'Debit Note (Supplier)' });
    await userEvent.click(debitToggle);

    await waitFor(() => {
      expect(screen.getByText('Supplier Details')).toBeInTheDocument();
    });

    // Select supplier
    const supplierInput = screen.getByTestId('supplier-select-input');
    await userEvent.type(supplierInput, 'supp-456');

    // Enter supplier reference
    const refInput = screen.getByPlaceholderText('e.g. DN-SUP-1029');
    await userEvent.type(refInput, 'REF-999');

    // Fill line description and amount
    const descInput = screen.getByPlaceholderText('Line description...');
    await userEvent.type(descInput, 'Supplier Shortage Credit');

    const selectAccount = screen.getByRole('combobox');
    await userEvent.selectOptions(selectAccount, 'acc-2');

    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '75.00');

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Issue Debit Note' });
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.purchaseDebitNotesControllerCreateDebitNote).toHaveBeenCalledWith({
        vendorId: 'supp-456',
        supplierReferenceNumber: 'REF-999',
        notes: undefined,
        lines: [
          {
            description: 'Supplier Shortage Credit',
            amount: '75.00',
            accountId: 'acc-2',
            quantityInvoiced: '1',
            pricePerUnit: '75.00',
          },
        ],
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
