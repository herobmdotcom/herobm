import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import AccountDetailPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('react', () => {
  const original = jest.requireActual('react');
  return {
    ...original,
    use: (promiseOrContext: any) => {
      if (promiseOrContext && typeof promiseOrContext.then === 'function') {
        return { id: 'cust-1' };
      }
      return original.use ? original.use(promiseOrContext) : promiseOrContext;
    },
  };
});

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'AUD',
    app: {},
  }),
}));

jest.mock('@/components/shared/AuthGate', () => ({
  useAuth: () => ({
    permissions: [{ resource: 'customers', action: 'read' }, { resource: 'customers', action: 'write' }],
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('../useCustomer', () => ({
  useAccount: () => ({
    customer: {
      customerId: 'cust-1',
      customerNumber: 'CUST-001',
      name: 'Acme Test Customer',
      stateCode: 'active',
      emailAddress1: 'billing@acme.com',
      contacts: [],
      childAccounts: [],
    },
    dto: {
      customerNumber: 'CUST-001',
      name: 'Acme Test Customer',
    },
    loading: false,
    saving: false,
    isDirty: false,
    isEditable: true,
    taxPositions: [],
    tradingTerms: [],
    accountGroups: [],
    hasDiscountRules: false,
    creditAssessment: null,
    loadAccount: jest.fn(),
    updateField: jest.fn(),
    saveField: jest.fn(),
    handleSave: jest.fn(),
    archiveAccount: jest.fn(),
    unarchiveAccount: jest.fn(),
  }),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
  pdfTemplatesControllerGetAssignments: jest.fn().mockResolvedValue({ data: [] }),
  customerGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  productGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  supplierGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  customersControllerFindOne: jest.fn().mockResolvedValue({
    data: {
      customerId: 'cust-1',
      customerNumber: 'CUST-001',
      name: 'Acme Test Customer',
      emailAddress1: 'billing@acme.com',
      contacts: [],
    },
  }),
  customersControllerEmailDocument: jest.fn().mockResolvedValue({ data: { success: true } }),
}));

describe('AccountDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Print Statement and Email Statement buttons in header', async () => {
    render(<AccountDetailPage params={Promise.resolve({ id: 'cust-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Print Statement')).toBeInTheDocument();
      expect(screen.getByText('Email Statement')).toBeInTheDocument();
    });
  });

  it('opens email statement dialog when Email Statement button is clicked', async () => {
    render(<AccountDetailPage params={Promise.resolve({ id: 'cust-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Email Statement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Email Statement'));

    await waitFor(() => {
      expect(screen.getByText('Email Customer Statement')).toBeInTheDocument();
    });
  });
});
