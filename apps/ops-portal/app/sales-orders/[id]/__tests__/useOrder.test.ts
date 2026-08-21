/**
 * useOrder.test.ts
 *
 * Tests the computed values and mutation call shapes from
 * the useOrder hook, without rendering any UI.
 */
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock('react-hot-toast', () => ({
    toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

const mockSdkFetch = jest.fn();
const mockSdkMutate = jest.fn();
jest.mock('@/lib/api', () => ({
    reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
    __esModule: true,
    ordersControllerFindOne: (...args: any[]) => mockSdkFetch(...args),
    orderPickingControllerGetPickingSummary: (...args: any[]) => mockSdkFetch('/picking', ...args),
    inventoryControllerFindAllLocations: () => mockSdkFetch('/locations'),
    taxCategoriesControllerFindAll: () => mockSdkFetch('/tax-categories'),
    ordersControllerUpdate: (...args: any[]) => mockSdkMutate('update', ...args),
    ordersControllerChangeState: (...args: any[]) => mockSdkMutate('changeState', ...args),
    ordersControllerUpdateLine: (...args: any[]) => mockSdkMutate('updateLine', ...args),
    ordersControllerCreate: (...args: any[]) => mockSdkMutate('create', ...args),
    ordersControllerArchive: (...args: any[]) => mockSdkMutate('archive', ...args),
    ordersControllerUnarchive: (...args: any[]) => mockSdkMutate('unarchive', ...args),
    ordersControllerRemoveLine: (...args: any[]) => mockSdkMutate('removeLine', ...args),
    ordersControllerAddLine: (...args: any[]) => mockSdkMutate('addLine', ...args),
    ordersControllerAddPostConfirmationLine: (...args: any[]) => mockSdkMutate('addPostConfirmationLine', ...args),
    inventoryControllerFindByProductIdsBulk: (...args: any[]) => mockSdkMutate('inventoryBulk', ...args),
    orderShipmentsControllerFindShipments: (...args: any[]) => mockSdkFetch('/shipments', ...args),
    orderReturnsControllerFindReturns: (...args: any[]) => mockSdkFetch('/returns', ...args),
    salesInvoiceControllerGetSalesInvoices: (...args: any[]) => mockSdkFetch('/invoices', ...args),
}));

import { useOrder } from '../useOrder';
import type { OrderDetail } from '../types';
import { SALES_ORDER_STATE } from '@herobm/shared';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
    return {
        salesOrderId: 'so-001',
        orderNumber: 'SO-001',
        name: 'Test Order',
        customerId: 'cust-1',
        customerName: 'ACME',
        customerOrderNumber: 'PO-123',
        stateCode: SALES_ORDER_STATE.DRAFT,
        currencyCode: 'AUD',
        notes: 'Some notes',
        createdBy: 'admin',
        createdOn: '2024-01-01',
        modifiedOn: '2024-01-01',
        lines: [
            {
                salesOrderLineId: 'line-1',
                lineNumber: 1,
                productId: 'prod-1',
                productNumber: 'WDG-001',
                productDescription: 'Widget',
                quantity: '10',
                pricePerUnit: '50.00',
                discountPercentage: '0',
                amount: '500.00',
                taxCategoryId: null,
                tax: '50.00',
                totalAmount: '550.00',
                unitOfMeasure: 'EA',
            },
            {
                salesOrderLineId: 'line-2',
                lineNumber: 2,
                productId: 'prod-2',
                productNumber: 'WDG-002',
                productDescription: 'Gadget',
                quantity: '5',
                pricePerUnit: '100.00',
                discountPercentage: '10',
                amount: '450.00',
                taxCategoryId: null,
                tax: '45.00',
                totalAmount: '495.00',
                unitOfMeasure: 'EA',
            },
        ],
        events: [],
        ...overrides,
    };
}

function setupMocks(order: OrderDetail) {
    mockSdkFetch.mockImplementation((url: string) => {
        if (url.includes('/picking')) return Promise.resolve({ data: null });
        if (url.includes('/tax-categories')) return Promise.resolve({ data: [] });
        return Promise.resolve({ data: order });
    });
    mockSdkMutate.mockResolvedValue({});
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useOrder — computed values', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calculates subtotal from order lines', async () => {
        const order = makeOrder();
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        // 500 + 450 = 950
        expect(result.current.subtotal).toBe(950);
    });

    it('calculates totalTax from order lines', async () => {
        const order = makeOrder();
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        // 50 + 45 = 95
        expect(result.current.totalTax).toBe(95);
    });

    it('isOrderDetailsEditable is true for app source + editable state', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.DRAFT });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.isOrderDetailsEditable).toBe(true);
    });

    it.each([SALES_ORDER_STATE.CANCELLED, SALES_ORDER_STATE.ARCHIVED])(
        'isOrderDetailsEditable is false for %s state',
        async (state) => {
            const order = makeOrder({ stateCode: state });
            setupMocks(order);

            const { result } = renderHook(() => useOrder('so-001'));
            await waitFor(() => expect(result.current.order).toBeTruthy());

            expect(result.current.isOrderDetailsEditable).toBe(false);
        },
    );

    it('isOrderDetailsEditable is true for editable state', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.DRAFT });
        setupMocks(order);
 
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
 
        expect(result.current.isOrderDetailsEditable).toBe(true);
    });
 
    it('isOrderLinesEditable is true only for app + draft', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.DRAFT });
        setupMocks(order);
 
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
 
        expect(result.current.isOrderLinesEditable).toBe(true);
    });

    it('isOrderLinesEditable is false for confirmed state', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.CONFIRMED });
        setupMocks(order);
 
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
 
        expect(result.current.isOrderLinesEditable).toBe(false);
    });
 
    it('allowedTransitions returns correct transitions for app source', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.DRAFT });
        setupMocks(order);
 
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
 
        expect(result.current.allowedTransitions).toEqual([SALES_ORDER_STATE.QUOTED, SALES_ORDER_STATE.CANCELLED]);
    });
 
    it('allowedTransitions reflects state transitions', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.DRAFT });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.allowedTransitions).toEqual(['quoted', 'cancelled']);
    });

    it('allowedTransitions contains archived for invoiced state', async () => {
        const order = makeOrder({ stateCode: SALES_ORDER_STATE.INVOICED });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.allowedTransitions).toEqual([SALES_ORDER_STATE.ARCHIVED]);
    });
});

describe('useOrder — mutations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupMocks(makeOrder());
    });

    it('saveHeader calls PATCH with correct body', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        // Simulate header edit to make it dirty
        act(() => result.current.setEditName('New Name'));
        await waitFor(() => expect(result.current.headerDirty).toBe(true));

        await act(async () => { await result.current.saveHeader(); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'update',
            'so-001',
            expect.objectContaining({ name: 'New Name' }),
        );
    });

    it('changeState calls PATCH with stateCode', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
 
        await act(async () => { await result.current.changeState(SALES_ORDER_STATE.QUOTED); });
 
        expect(mockSdkMutate).toHaveBeenCalledWith(
            'changeState',
            'so-001',
            expect.objectContaining({ stateCode: SALES_ORDER_STATE.QUOTED }),
        );
    });

    it('updateLine calls PATCH on the correct endpoint', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.updateLine('line-1', 'quantity', '20'); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'updateLine',
            'so-001',
            'line-1',
            { quantity: '20' },
        );
    });



    it('archiveOrder calls POST after confirm', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.archiveOrder(); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'archive',
            'so-001',
            { body: {} }
        );

        jest.restoreAllMocks();
    });

    it('archiveOrder does nothing when confirm is cancelled', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockSdkMutate.mockClear();

        await act(async () => { await result.current.archiveOrder(); });

        expect(mockSdkMutate).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it('unarchiveOrder calls POST', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.unarchiveOrder(); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'unarchive',
            'so-001',
            { body: {} }
        );
    });

    it('removeLine calls DELETE after confirm', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.removeLine('line-1'); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'removeLine',
            'so-001',
            'line-1'
        );

        jest.restoreAllMocks();
    });

    it('removeLine does nothing when confirm is cancelled', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockSdkMutate.mockClear();

        await act(async () => { await result.current.removeLine('line-1'); });

        expect(mockSdkMutate).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it('addLineFromProduct calls POST with product data', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        const product = {
            productId: 'prod-new',
            productNumber: 'NEW-001',
            name: 'New Product',
            listPrice: '75.00',
            tradePrice: '70.00',
        };

        await act(async () => { await result.current.addLineFromProduct(product as unknown as import('@herobm/sdk').ProductResponseDto); });

        expect(mockSdkMutate).toHaveBeenCalledWith(
            'addLine',
            'so-001',
            expect.objectContaining({
                productId: 'prod-new',
                productDescription: 'New Product',
                quantity: '1',
                pricePerUnit: '75.00',
            }),
        );
    });

    it('addLineFromProduct rejects duplicates with toast error', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Inline require used to mock or verify toast triggers in local tests.
        const { toast } = require('react-hot-toast');

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockSdkMutate.mockClear();

        // prod-1 is already in the order lines
        const duplicate = {
            productId: 'prod-1',
            productNumber: 'WDG-001',
            name: 'Widget',
            listPrice: '50.00',
        };

        await act(async () => { await result.current.addLineFromProduct(duplicate as unknown as import('@herobm/sdk').ProductResponseDto); });

        expect(mockSdkMutate).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalled();
    });

    it('saveHeader sets error on failure', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        act(() => result.current.setEditName('Changed'));
        await waitFor(() => expect(result.current.headerDirty).toBe(true));

        mockSdkMutate.mockRejectedValueOnce(new Error('Network error'));
        await act(async () => { await result.current.saveHeader(); });

        expect(result.current.error).toBe('Network error');
    });
});
