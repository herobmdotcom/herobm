import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditPurchaseOrderClient from '../EditPurchaseOrderClient';
import { PURCHASE_ORDER_STATE } from '@herobm/shared';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/components/shared/AuthGate', () => ({
  useAuth: () => ({ permissions: [] }),
}));

const mockOrder = {
  purchaseOrderId: 'po-123',
  orderNumber: 'PO-123',
  name: 'Test Purchase Order',
  vendorId: 'vend-1',
  vendorName: 'Acme Supplies',
  referenceNumber: 'REF-001',
  stateCode: PURCHASE_ORDER_STATE.DRAFT,
  currencyCode: 'EUR',
  taxCategoryId: null,
  deliveryLocationId: 'loc-1',
  locationName: 'Warehouse A',
  notes: 'Test notes',
  createdBy: 'admin',
  createdOn: '2026-01-01T00:00:00Z',
  modifiedOn: '2026-01-01T00:00:00Z',
  expectedDate: '2026-01-10T00:00:00Z',
  lines: [],
  events: [],
};

const mockUsePurchaseOrder = jest.fn();
jest.mock('../usePurchaseOrder', () => ({
  usePurchaseOrder: (id: string) => mockUsePurchaseOrder(id),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  taxCategoriesControllerFindAll: () => Promise.resolve({ data: [] }),
  inventoryControllerFindAllLocations: () => Promise.resolve({ data: [] }),
  allocationsControllerGetAllocationsByPo: () => Promise.resolve({ data: [] }),
  purchaseReturnsControllerFindReturns: () => Promise.resolve({ data: [] }),
  purchaseInvoiceControllerGetPurchaseBills: () => Promise.resolve({ data: [] }),
  goodsReceivedControllerFindAllLines: () => Promise.resolve({ data: { data: [] } }),
}));

describe('EditPurchaseOrderClient - Currency Dropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders currency select dropdown when order header is editable', () => {
    const saveHeader = jest.fn();
    const setEditCurrencyCode = jest.fn();

    mockUsePurchaseOrder.mockReturnValue({
      order: mockOrder,
      loading: false,
      error: '',
      saving: false,
      copying: false,
      latestAutoTransition: null,
      isHeaderEditable: true,
      isLinesEditable: true,
      visibleTransitions: [],
      subtotal: 0,
      totalTax: 0,
      editName: 'Test Purchase Order',
      setEditName: jest.fn(),
      editReferenceNumber: 'REF-001',
      setEditReferenceNumber: jest.fn(),
      editExpectedDate: '2026-01-10',
      setEditExpectedDate: jest.fn(),
      editNotes: 'Test notes',
      setEditNotes: jest.fn(),
      editLocationId: 'loc-1',
      setEditLocationId: jest.fn(),
      editCurrencyCode: 'EUR',
      setEditCurrencyCode,
      headerDirty: false,
      taxCategories: [],
      activeTab: 'lines',
      setActiveTab: jest.fn(),
      inventoryData: [],
      inventoryLoading: false,
      invoices: [],
      setInvoicing: jest.fn(),
      clearError: jest.fn(),
      setError: jest.fn(),
      saveHeader,
      changeState: jest.fn(),
      archivePurchaseOrder: jest.fn(),
      unarchivePurchaseOrder: jest.fn(),
      copyOrder: jest.fn(),
      updateLine: jest.fn(),
      updateLineFields: jest.fn(),
      removeLine: jest.fn(),
      addLineFromProduct: jest.fn(),
      addBlankLine: jest.fn(),
      loadOrder: jest.fn(),
      loadInvoices: jest.fn(),
      loadAllocations: jest.fn(),
      allocations: [],
      allocationsLoading: false,
    });

    render(<EditPurchaseOrderClient id="po-123" />);

    const currencySelect = screen.getByDisplayValue('EUR - Euro');
    expect(currencySelect).toBeInTheDocument();
    expect(currencySelect).toBeEnabled();

    fireEvent.change(currencySelect, { target: { value: 'USD' } });
    expect(setEditCurrencyCode).toHaveBeenCalledWith('USD');

    fireEvent.blur(currencySelect);
    expect(saveHeader).toHaveBeenCalled();
  });

  it('renders currency as formatted text when order header is not editable', () => {
    mockUsePurchaseOrder.mockReturnValue({
      order: { ...mockOrder, stateCode: PURCHASE_ORDER_STATE.ARCHIVED, currencyCode: 'USD' },
      loading: false,
      error: '',
      saving: false,
      copying: false,
      latestAutoTransition: null,
      isHeaderEditable: false,
      isLinesEditable: false,
      visibleTransitions: [],
      subtotal: 0,
      totalTax: 0,
      editName: 'Test Purchase Order',
      setEditName: jest.fn(),
      editReferenceNumber: 'REF-001',
      setEditReferenceNumber: jest.fn(),
      editExpectedDate: '2026-01-10',
      setEditExpectedDate: jest.fn(),
      editNotes: 'Test notes',
      setEditNotes: jest.fn(),
      editLocationId: 'loc-1',
      setEditLocationId: jest.fn(),
      editCurrencyCode: 'USD',
      setEditCurrencyCode: jest.fn(),
      headerDirty: false,
      taxCategories: [],
      activeTab: 'lines',
      setActiveTab: jest.fn(),
      inventoryData: [],
      inventoryLoading: false,
      invoices: [],
      setInvoicing: jest.fn(),
      clearError: jest.fn(),
      setError: jest.fn(),
      saveHeader: jest.fn(),
      changeState: jest.fn(),
      archivePurchaseOrder: jest.fn(),
      unarchivePurchaseOrder: jest.fn(),
      copyOrder: jest.fn(),
      updateLine: jest.fn(),
      updateLineFields: jest.fn(),
      removeLine: jest.fn(),
      addLineFromProduct: jest.fn(),
      addBlankLine: jest.fn(),
      loadOrder: jest.fn(),
      loadInvoices: jest.fn(),
      loadAllocations: jest.fn(),
      allocations: [],
      allocationsLoading: false,
    });

    render(<EditPurchaseOrderClient id="po-123" />);

    expect(screen.getByText('USD - US Dollar')).toBeInTheDocument();
  });
});
