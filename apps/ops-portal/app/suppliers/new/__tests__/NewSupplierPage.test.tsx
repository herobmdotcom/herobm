import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewSupplierPage from '../page';
import * as api from '@herobm/sdk';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      'buttons.createSupplier': 'Create Supplier',
      management: 'Vendor Management',
      'columns.vendorNumber': 'Vendor #',
      'columns.name': 'Name',
      cancel: 'Cancel',
      saving: 'Saving...',
      'toast.supplierCreated': 'Supplier created',
      'new.documentTitle': 'New Supplier',
      generalInfo: 'General Info',
      'fields.selectCurrency': 'Select currency',
    };
    return map[key] || key;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'EUR',
    organization: { country: 'DE' },
    app: {},
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  taxPositionsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  supplierGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  tradingTermsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  suppliersControllerCreate: jest.fn(),
}));

describe('NewSupplierPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Cancel and Create Supplier action buttons in the EntityHeader', async () => {
    render(<NewSupplierPage />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Supplier' })).toBeInTheDocument();
  });

  it('navigates to /suppliers when Cancel is clicked', async () => {
    render(<NewSupplierPage />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockPush).toHaveBeenCalledWith('/suppliers');
  });

  it('disables Create Supplier button when required fields are missing and enables when filled', async () => {
    render(<NewSupplierPage />);

    const createButton = screen.getByRole('button', { name: 'Create Supplier' });
    // Initially vendorNumber and name are empty, so it should be disabled
    expect(createButton).toBeDisabled();

    // Fill vendorNumber and name
    const vendorInput = screen.getByPlaceholderText('placeholders.vendorNumber');
    const nameInput = screen.getByPlaceholderText('placeholders.name');

    fireEvent.change(vendorInput, { target: { value: 'SUP-001' } });
    fireEvent.change(nameInput, { target: { value: 'Acme Supplies' } });

    expect(createButton).toBeEnabled();
  });

  it('submits the supplier and redirects on successful creation', async () => {
    (api.suppliersControllerCreate as jest.Mock).mockResolvedValue({
      data: { vendorId: 'supp-123' },
    });

    render(<NewSupplierPage />);

    const vendorInput = screen.getByPlaceholderText('placeholders.vendorNumber');
    const nameInput = screen.getByPlaceholderText('placeholders.name');

    fireEvent.change(vendorInput, { target: { value: 'SUP-001' } });
    fireEvent.change(nameInput, { target: { value: 'Acme Supplies' } });

    const createButton = screen.getByRole('button', { name: 'Create Supplier' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(api.suppliersControllerCreate).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/suppliers/supp-123');
    });
  });
});
