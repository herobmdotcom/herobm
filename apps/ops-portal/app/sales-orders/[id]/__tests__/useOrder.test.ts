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

const mockApiFetch = jest.fn();
const mockApiMutate = jest.fn();
jest.mock('@/lib/api', () => ({
    apiFetch: (...args: any[]) => mockApiFetch(...args),
    apiMutate: (...args: any[]) => mockApiMutate(...args),
    reportError: jest.fn(),
}));

import { useOrder } from '../useOrder';
import type { OrderDetail } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
    return {
        salesOrderId: 'so-001',
        orderNumber: 'SO-001',
        name: 'Test Order',
        customerId: 'cust-1',
        customerName: 'ACME',
        customerOrderNumber: 'PO-123',
        stateCode: 'draft',
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
                gstCategoryId: null,
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
                gstCategoryId: null,
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
    mockApiFetch.mockImplementation((url: string) => {
        if (url.includes('/picking')) return Promise.resolve(null);
        if (url.includes('/gst-categories')) return Promise.resolve([]);
        return Promise.resolve(order);
    });
    mockApiMutate.mockResolvedValue({});
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
        const order = makeOrder({ stateCode: 'draft' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.isOrderDetailsEditable).toBe(true);
    });

    it.each(['cancelled', 'legacy', 'archived'])(
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
        const order = makeOrder({ stateCode: 'draft' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.isOrderDetailsEditable).toBe(true);
    });

    it('isOrderLinesEditable is true only for app + draft', async () => {
        const order = makeOrder({ stateCode: 'draft' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.isOrderLinesEditable).toBe(true);
    });

    it('isOrderLinesEditable is false for confirmed state', async () => {
        const order = makeOrder({ stateCode: 'confirmed' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.isOrderLinesEditable).toBe(false);
    });

    it('allowedTransitions returns correct transitions for app source', async () => {
        const order = makeOrder({ stateCode: 'draft' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.allowedTransitions).toEqual(['quoted', 'cancelled']);
    });

    it('allowedTransitions reflects state transitions', async () => {
        const order = makeOrder({ stateCode: 'draft' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.allowedTransitions).toEqual(['quoted', 'cancelled']);
    });

    it('allowedTransitions is empty for terminal states', async () => {
        const order = makeOrder({ stateCode: 'invoiced' });
        setupMocks(order);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        expect(result.current.allowedTransitions).toEqual([]);
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

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001',
            'PATCH',
            expect.objectContaining({ name: 'New Name' }),
        );
    });

    it('changeState calls PATCH with stateCode', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.changeState('quoted'); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/state',
            'PATCH',
            { stateCode: 'quoted' },
        );
    });

    it('updateLine calls PATCH on the correct endpoint', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.updateLine('line-1', 'quantity', '20'); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/lines/line-1',
            'PATCH',
            { quantity: '20' },
        );
    });

    it('copyOrder calls POST and navigates to new order', async () => {
        mockApiMutate.mockResolvedValueOnce({ salesOrderId: 'so-002' });

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.copyOrder(); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders',
            'POST',
            expect.objectContaining({
                name: 'Copy of Test Order',
                customerId: 'cust-1',
                lines: expect.arrayContaining([
                    expect.objectContaining({ productId: 'prod-1', quantity: '10' }),
                ]),
            }),
        );
        expect(mockPush).toHaveBeenCalledWith('/sales-orders/so-002');
    });

    it('archiveOrder calls POST after confirm', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.archiveOrder(); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/archive',
            'POST',
        );

        jest.restoreAllMocks();
    });

    it('archiveOrder does nothing when confirm is cancelled', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockApiMutate.mockClear();

        await act(async () => { await result.current.archiveOrder(); });

        expect(mockApiMutate).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it('unarchiveOrder calls POST', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.unarchiveOrder(); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/unarchive',
            'POST',
        );
    });

    it('removeLine calls DELETE after confirm', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        await act(async () => { await result.current.removeLine('line-1'); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/lines/line-1',
            'DELETE',
        );

        jest.restoreAllMocks();
    });

    it('removeLine does nothing when confirm is cancelled', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockApiMutate.mockClear();

        await act(async () => { await result.current.removeLine('line-1'); });

        expect(mockApiMutate).not.toHaveBeenCalled();
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

        await act(async () => { await result.current.addLineFromProduct(product as any); });

        expect(mockApiMutate).toHaveBeenCalledWith(
            '/api/sales-orders/so-001/lines',
            'POST',
            expect.objectContaining({
                productId: 'prod-new',
                productDescription: 'New Product',
                quantity: '1',
                pricePerUnit: '75.00',
            }),
        );
    });

    it('addLineFromProduct rejects duplicates with toast error', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { toast } = require('react-hot-toast');

        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());
        mockApiMutate.mockClear();

        // prod-1 is already in the order lines
        const duplicate = {
            productId: 'prod-1',
            productNumber: 'WDG-001',
            name: 'Widget',
            listPrice: '50.00',
        };

        await act(async () => { await result.current.addLineFromProduct(duplicate as any); });

        expect(mockApiMutate).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('saveHeader sets error on failure', async () => {
        const { result } = renderHook(() => useOrder('so-001'));
        await waitFor(() => expect(result.current.order).toBeTruthy());

        act(() => result.current.setEditName('Changed'));
        await waitFor(() => expect(result.current.headerDirty).toBe(true));

        mockApiMutate.mockRejectedValueOnce(new Error('Network error'));
        await act(async () => { await result.current.saveHeader(); });

        expect(result.current.error).toBe('Network error');
    });
});
