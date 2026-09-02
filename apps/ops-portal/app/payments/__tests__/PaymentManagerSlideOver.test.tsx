import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PaymentManagerSlideOver from '../PaymentManagerSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'AUD',
    app: {},
  }),
}));

jest.mock('@/components/shared/AuthGate', () => ({
  useAuth: () => ({
    permissions: [{ resource: 'payments', action: 'read' }, { resource: 'payments', action: 'write' }],
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
  pdfTemplatesControllerGetAssignments: jest.fn().mockResolvedValue({ data: [] }),
  macrosControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  paymentsControllerFindOne: jest.fn(),
  suppliersControllerFindOne: jest.fn().mockResolvedValue({
    data: {
      vendorId: 'vend-1',
      vendorNumber: 'VEND-001',
      name: 'Apex Industrial Supplies',
      emailAddress1: 'accounts@apex.com',
      contacts: [],
    },
  }),
  customersControllerFindOne: jest.fn().mockResolvedValue({
    data: {
      customerId: 'cust-1',
      customerNumber: 'CUST-001',
      name: 'Acme Commercial Ltd',
      emailAddress1: 'accounts@acme.com',
      contacts: [],
    },
  }),
  glControllerGetJournalEntryBySource: jest.fn().mockResolvedValue({ data: null }),
  purchasingControllerFindAllInvoices: jest.fn().mockResolvedValue({ data: [] }),
  paymentsControllerEmailDocument: jest.fn().mockResolvedValue({ data: { success: true } }),
}));

describe('PaymentManagerSlideOver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Print Remittance and Email Remittance buttons for supplier payment', async () => {
    (api.paymentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        paymentId: 'pmt-1',
        paymentNumber: 'PMT-20260822-0001',
        paymentType: 'supplier_payment',
        partyId: 'vend-1',
        partyName: 'Apex Industrial Supplies',
        paymentDate: '2026-08-22T00:00:00Z',
        modeOfPayment: 'EFT',
        totalAmount: '1450.00',
        unallocatedAmount: '0.00',
        stateCode: 'submitted',
        currencyCode: 'AUD',
        glAccountBank: 'gl-bank-1',
        allocations: [],
      },
    });

    render(
      <PaymentManagerSlideOver
        paymentId="pmt-1"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Print Remittance')).toBeInTheDocument();
      expect(screen.getByText('Email Remittance')).toBeInTheDocument();
    });
  });

  it('opens email remittance advice dialog when Email Remittance button is clicked', async () => {
    (api.paymentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        paymentId: 'pmt-1',
        paymentNumber: 'PMT-20260822-0001',
        paymentType: 'supplier_payment',
        partyId: 'vend-1',
        partyName: 'Apex Industrial Supplies',
        paymentDate: '2026-08-22T00:00:00Z',
        modeOfPayment: 'EFT',
        totalAmount: '1450.00',
        unallocatedAmount: '0.00',
        stateCode: 'submitted',
        currencyCode: 'AUD',
        glAccountBank: 'gl-bank-1',
        allocations: [],
      },
    });

    render(
      <PaymentManagerSlideOver
        paymentId="pmt-1"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Email Remittance')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Email Remittance'));

    await waitFor(() => {
      expect(screen.getByText('Email Remittance Advice')).toBeInTheDocument();
    });
  });

  it('renders Print Receipt and Email Receipt buttons for customer payment', async () => {
    (api.paymentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        paymentId: 'pmt-2',
        paymentNumber: 'REC-20260822-0002',
        paymentType: 'customer_receipt',
        partyId: 'cust-1',
        partyName: 'Acme Commercial Ltd',
        paymentDate: '2026-08-22T00:00:00Z',
        modeOfPayment: 'Credit Card',
        totalAmount: '1450.00',
        unallocatedAmount: '0.00',
        stateCode: 'submitted',
        currencyCode: 'AUD',
        glAccountBank: 'gl-bank-1',
        allocations: [],
      },
    });

    render(
      <PaymentManagerSlideOver
        paymentId="pmt-2"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Print Receipt')).toBeInTheDocument();
      expect(screen.getByText('Email Receipt')).toBeInTheDocument();
    });
  });

  it('opens email payment receipt dialog when Email Receipt button is clicked', async () => {
    (api.paymentsControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        paymentId: 'pmt-2',
        paymentNumber: 'REC-20260822-0002',
        paymentType: 'customer_receipt',
        partyId: 'cust-1',
        partyName: 'Acme Commercial Ltd',
        paymentDate: '2026-08-22T00:00:00Z',
        modeOfPayment: 'Credit Card',
        totalAmount: '1450.00',
        unallocatedAmount: '0.00',
        stateCode: 'submitted',
        currencyCode: 'AUD',
        glAccountBank: 'gl-bank-1',
        allocations: [],
      },
    });

    render(
      <PaymentManagerSlideOver
        paymentId="pmt-2"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Email Receipt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Email Receipt'));

    await waitFor(() => {
      expect(screen.getByText('Email Payment Receipt')).toBeInTheDocument();
    });
  });
});
