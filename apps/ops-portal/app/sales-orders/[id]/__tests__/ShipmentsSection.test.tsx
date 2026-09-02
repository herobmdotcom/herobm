import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShipmentsSection from '../ShipmentsSection';
import type { OrderDetail } from '../types';
import * as api from '@herobm/sdk';
import { calculateShippableQuantities } from '@/lib/sales-order-utils';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('next-intl', () => ({
    useTranslations: (ns?: string) => Object.assign(
        (key: string, params?: Record<string, unknown>) => {
            if (params && 'count' in params) return `${params.count} lines`;
            return key;
        },
        { has: () => true }
    ),
}));

jest.mock('react-hot-toast', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@/lib/api', () => ({
    reportError: jest.fn(),
    getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

jest.mock('@herobm/sdk', () => ({
    orderShipmentsControllerFindShipments: jest.fn(),
    orderShipmentsControllerCreateShipment: jest.fn(),
}));

jest.mock('@/lib/sales-order-utils', () => {
    const actual = jest.requireActual('@/lib/sales-order-utils');
    return {
        ...actual,
        calculateShippableQuantities: jest.fn(),
    };
});

const mockCalcShippable = calculateShippableQuantities as jest.MockedFunction<
    typeof calculateShippableQuantities
>;

// ── Fixtures ─────────────────────────────────────────────────────────

const baseOrder: OrderDetail = {
    salesOrderId: 'so-1',
    orderNumber: 'SO-0001',
    name: 'Test Order',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    customerOrderNumber: 'PO-123',
    stateCode: 'confirmed',
    currencyCode: 'AUD',
    notes: '',
    createdBy: 'admin',
    createdOn: '2024-01-01',
    modifiedOn: '2024-01-01',
    lines: [
        {
            salesOrderLineId: 'L1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: 'NS-001',
            productDescription: 'Non-stock hardware',
            productType: 'non-stock',
            quantity: '3',
            pricePerUnit: '100.00',
            discountPercentage: '0',
            amount: '300.00',
            taxCategoryId: null,
            tax: '30.00',
            totalAmount: '330.00',
            unitOfMeasure: 'EA',
        },
    ],
    events: [],
};

const defaultProps = {
    orderId: 'so-1',
    order: baseOrder,
    pickingSummary: { lines: [] },
    loadOrder: jest.fn(),
    setError: jest.fn(),
};

describe('ShipmentsSection — rendering & permissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [],
        });
        mockCalcShippable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
    });

    it('shows Create Shipment button for confirmed order with shippable lines', async () => {
        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
        });
        expect(screen.getByText('buttons.createShipment')).not.toBeDisabled();
    });

    it('disables Create Shipment button when order has no shippable lines', async () => {
        mockCalcShippable.mockReturnValue([]);
        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
        });
        expect(screen.getByText('buttons.createShipment')).toBeDisabled();
    });

    it('shows existing shipment in the list', async () => {
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [
                {
                    shipmentId: 'ship-1',
                    shipmentNumber: 'SHP-20260901-0001',
                    stateCode: 'dispatched',
                    trackingNumber: 'TRACK-999',
                    createdOn: '2026-09-01T10:00:00Z',
                    createdBy: 'admin',
                    lines: [{ shipmentLineId: 'sl-1', salesOrderLineId: 'L1', quantityShipped: '3' }],
                },
            ],
        });

        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('SHP-20260901-0001')).toBeInTheDocument();
        });
    });
});

describe('ShipmentsSection — create shipment form & dispatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [],
        });
        (api.orderShipmentsControllerCreateShipment as jest.Mock).mockResolvedValue({
            data: { shipmentId: 'ship-new' },
        });
        mockCalcShippable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
    });

    it('opens creation form, accepts tracking info and calls API', async () => {
        const user = userEvent.setup();
        const loadOrder = jest.fn().mockResolvedValue(undefined);
        render(React.createElement(ShipmentsSection, { ...defaultProps, loadOrder }));

        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
        });

        await user.click(screen.getByText('buttons.createShipment'));

        expect(screen.getByPlaceholderText('placeholders.tracking')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('placeholders.notes')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('placeholders.tracking'), 'TRACK-12345');
        await user.type(screen.getByPlaceholderText('placeholders.notes'), 'Drop-shipped from vendor');

        const submitButtons = screen.getAllByText('buttons.createShipment');
        const submitBtn = submitButtons[submitButtons.length - 1];
        await user.click(submitBtn);

        await waitFor(() => {
            expect(api.orderShipmentsControllerCreateShipment).toHaveBeenCalledWith(
                'so-1',
                expect.objectContaining({
                    trackingNumber: 'TRACK-12345',
                    notes: 'Drop-shipped from vendor',
                    lines: [{ salesOrderLineId: 'L1', quantityShipped: '3' }],
                }),
            );
        });

        expect(loadOrder).toHaveBeenCalled();
    });
});

