import { renderHook, act, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

const mockSdkFetch = jest.fn();
const mockSdkMutate = jest.fn();
jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  purchaseOrdersControllerFindOne: (...args: any[]) => mockSdkFetch('findOne', ...args),
  taxCategoriesControllerFindAll: () => Promise.resolve({ data: [] }),
  purchaseOrdersControllerUpdate: (...args: any[]) => mockSdkMutate('update', ...args),
  purchaseOrdersControllerChangeState: (...args: any[]) => mockSdkMutate('changeState', ...args),
  purchaseOrdersControllerUpdateLine: (...args: any[]) => mockSdkMutate('updateLine', ...args),
  purchaseOrdersControllerCreate: (...args: any[]) => mockSdkMutate('create', ...args),
  purchaseOrdersControllerArchive: (...args: any[]) => mockSdkMutate('archive', ...args),
  purchaseOrdersControllerUnarchive: (...args: any[]) => mockSdkMutate('unarchive', ...args),
  purchaseOrdersControllerRemoveLine: (...args: any[]) => mockSdkMutate('removeLine', ...args),
  purchaseOrdersControllerAddLine: (...args: any[]) => mockSdkMutate('addLine', ...args),
  allocationsControllerGetAllocationsByPo: () => Promise.resolve({ data: [] }),
  purchaseReturnsControllerFindReturns: () => Promise.resolve({ data: [] }),
  purchaseInvoiceControllerGetPurchaseBills: () => Promise.resolve({ data: [] }),
}));

import { usePurchaseOrder } from '../usePurchaseOrder';
import type { OrderDetail } from '../types';
import { PURCHASE_ORDER_STATE } from '@herobm/shared';

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    purchaseOrderId: 'po-001',
    orderNumber: 'PO-001',
    name: 'Test Purchase Order',
    vendorId: 'vend-1',
    vendorName: 'Supplier Inc',
    referenceNumber: 'REF-123',
    stateCode: PURCHASE_ORDER_STATE.DRAFT,
    currencyCode: 'EUR',
    taxCategoryId: null,
    deliveryLocationId: 'loc-1',
    locationName: 'Main Warehouse',
    notes: 'Some notes',
    createdBy: 'admin',
    createdOn: '2026-01-01T00:00:00Z',
    modifiedOn: '2026-01-01T00:00:00Z',
    expectedDate: '2026-01-15T00:00:00Z',
    lines: [],
    events: [],
    ...overrides,
  };
}

describe('usePurchaseOrder - Currency Editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes editCurrencyCode from loaded order and tracks dirty state', async () => {
    const orderData = makeOrder({ currencyCode: 'USD' });
    mockSdkFetch.mockResolvedValueOnce({ data: orderData });

    const { result } = renderHook(() => usePurchaseOrder('po-001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.editCurrencyCode).toBe('USD');
    expect(result.current.headerDirty).toBe(false);

    act(() => {
      result.current.setEditCurrencyCode('GBP');
    });

    expect(result.current.editCurrencyCode).toBe('GBP');
    expect(result.current.headerDirty).toBe(true);
  });

  it('saves updated currencyCode on saveHeader', async () => {
    const orderData = makeOrder({ currencyCode: 'EUR' });
    mockSdkFetch.mockResolvedValue({ data: orderData });
    mockSdkMutate.mockResolvedValue({ data: { ...orderData, currencyCode: 'AUD' } });

    const { result } = renderHook(() => usePurchaseOrder('po-001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setEditCurrencyCode('AUD');
    });

    await act(async () => {
      await result.current.saveHeader();
    });

    expect(mockSdkMutate).toHaveBeenCalledWith('update', 'po-001', expect.objectContaining({
      currencyCode: 'AUD',
    }));
  });

  it('allows transition from ORDERED back to DRAFT when no goods are received', async () => {
    const orderData = makeOrder({
      stateCode: PURCHASE_ORDER_STATE.ORDERED,
      lines: [
        {
          purchaseOrderLineId: 'line-1',
          lineNumber: 1,
          productId: 'prod-1',
          productDescription: 'Widget',
          quantity: '10',
          quantityReceived: '0',
          pricePerUnit: '15.00',
          discountPercentage: '0',
          amount: '150.00',
          taxCategoryId: null,
          tax: '0',
          totalAmount: '150.00',
          unitOfMeasure: 'EA',
        },
      ],
    });
    mockSdkFetch.mockResolvedValueOnce({ data: orderData });

    const { result } = renderHook(() => usePurchaseOrder('po-001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const draftTransition = result.current.visibleTransitions.find(
      (t) => t.state === PURCHASE_ORDER_STATE.DRAFT
    );
    expect(draftTransition).toBeDefined();
    expect(draftTransition?.isBack).toBe(true);
  });

  it('blocks transition from ORDERED to DRAFT when goods have been received', async () => {
    const orderData = makeOrder({
      stateCode: PURCHASE_ORDER_STATE.ORDERED,
      lines: [
        {
          purchaseOrderLineId: 'line-1',
          lineNumber: 1,
          productId: 'prod-1',
          productDescription: 'Widget',
          quantity: '10',
          quantityReceived: '5',
          pricePerUnit: '15.00',
          discountPercentage: '0',
          amount: '150.00',
          taxCategoryId: null,
          tax: '0',
          totalAmount: '150.00',
          unitOfMeasure: 'EA',
        },
      ],
    });
    mockSdkFetch.mockResolvedValueOnce({ data: orderData });

    const { result } = renderHook(() => usePurchaseOrder('po-001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const draftTransition = result.current.visibleTransitions.find(
      (t) => t.state === PURCHASE_ORDER_STATE.DRAFT
    );
    expect(draftTransition).toBeUndefined();
  });
});
